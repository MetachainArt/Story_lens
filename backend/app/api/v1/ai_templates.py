"""AI template management, creative assets, and image generation routes."""

from datetime import datetime, timedelta, timezone
import hashlib
import json
import logging
from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse
from uuid import UUID

import anyio
import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...core.config import settings
from ...core.deps import CurrentUser, RequireTeacher, RequireTemplateManager
from ...core.privacy import photo_retention_values, require_photo_processing_consent
from ...core.security import create_media_token
from ...core.upload_paths import resolve_upload_path
from ...db.session import AsyncSessionLocal, get_db
from ...models.ai_templates import (
    AdjustmentPreset,
    Category,
    CreativeAsset,
    ImageGenerationJob,
    PromptTemplate,
    PromptTemplateVersion,
    SafetyEvent,
    TemplateUsageEvent,
)
from ...models.photo import Photo
from ...schemas.ai_templates import (
    AdjustmentPresetCreate,
    AdjustmentPresetResponse,
    AdjustmentPresetUpdate,
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    CreativeAssetCreate,
    CreativeAssetResponse,
    CreativeAssetUpdate,
    ImageGenerationJobResponse,
    ImageGenerationRequest,
    ImageGenerationResponse,
    PromptTemplateCreate,
    PromptTemplateResponse,
    PromptTemplateUpdate,
    TemplateStatusUpdate,
    TemplateUsageResponse,
)
from ...services.image_generation import (
    ImageProviderResult,
    get_image_provider,
    get_kie_task_result,
    persist_generated_image,
    render_prompt,
)
from ...services.safety import record_safety_event, screen_prompt
from ...core.rate_limit import rate_limit


router = APIRouter(tags=["ai-templates"])
admin_router = APIRouter(prefix="/admin", tags=["ai-admin"])
APP_ROOT = Path(__file__).resolve().parents[3]
UPLOAD_ROOT = (APP_ROOT / "uploads").resolve()
logger = logging.getLogger(__name__)
ALLOWED_IMAGE_ASPECT_RATIOS = {"1:1", "4:3", "16:9", "3:2", "2:3", "3:4", "9:16"}
KIE_SERVER_POLL_SECONDS = 5
KIE_SERVER_MAX_POLLS = 180


def _advisory_lock_key(scope: str, value: object) -> int:
    digest = hashlib.sha256(f"{scope}:{value}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big", signed=True)


async def _lock_generation_result(db: AsyncSession, job_id: UUID) -> None:
    await db.execute(select(func.pg_advisory_xact_lock(_advisory_lock_key("image-generation-result", job_id))))


def _absolute_public_url(path_or_url: str, request: Request) -> str:
    if path_or_url.startswith(("http://", "https://")):
        return path_or_url
    base_url = settings.PUBLIC_API_URL.strip().rstrip("/") or str(request.base_url).rstrip("/")
    normalized_path = path_or_url if path_or_url.startswith("/") else f"/{path_or_url}"
    if normalized_path.startswith("/uploads/"):
        media_path = normalized_path.lstrip("/")
        token = create_media_token(media_path, expires_delta=timedelta(minutes=15))
        return f"{base_url}/api/v1/media/{media_path}?token={token}"
    return f"{base_url}{normalized_path}"


def _is_loopback_url(url: str | None) -> bool:
    if not url:
        return False
    hostname = (urlparse(url).hostname or "").lower()
    return hostname in {"localhost", "127.0.0.1", "::1"}


def _resolve_local_upload_path(path_or_url: str | None, owner_id: UUID) -> Path | None:
    resolved = resolve_upload_path(APP_ROOT, path_or_url, photo_owner=owner_id)
    return resolved if resolved is not None and resolved.is_file() else None


def _remove_local_upload(path_or_url: str | None, owner_id: UUID) -> None:
    path = _resolve_local_upload_path(path_or_url, owner_id)
    if path is None:
        return
    try:
        path.unlink(missing_ok=True)
    except OSError as exc:
        logger.warning("Failed to remove generated image %s: %s", path, exc)


async def _latest_version(db: AsyncSession, template_id: UUID) -> PromptTemplateVersion | None:
    result = await db.execute(
        select(PromptTemplateVersion)
        .where(PromptTemplateVersion.template_id == template_id)
        .order_by(PromptTemplateVersion.version_number.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def _merge_values(template: PromptTemplate, values: dict[str, object]) -> dict[str, object]:
    merged = dict(template.default_values or {})
    for variable in template.variables or []:
        key = str(variable.get("key", "")).strip()
        if key and key not in merged:
            merged[key] = variable.get("default_value", "")
    for key, value in values.items():
        merged[key] = value.strip() if isinstance(value, str) else value
    return merged


def _safety_text_from_user_values(values: dict[str, object]) -> str:
    """Screen only user-entered option text, not the admin-approved template."""
    parts: list[str] = []
    for value in values.values():
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
        elif isinstance(value, list):
            parts.extend(str(item).strip() for item in value if str(item).strip())
    return "\n".join(parts)


def _validate_character_concept_values(
    template: PromptTemplate,
    values: dict[str, object],
) -> dict[str, object]:
    if not bool((template.locale_labels or {}).get("character_inspired_mode")):
        return values

    normalized = dict(values)
    for key, label in (("work_title", "애니메이션·영화 제목"), ("character_name", "캐릭터 이름")):
        value = str(normalized.get(key, "")).strip()
        if not value:
            raise HTTPException(status_code=422, detail=f"{label}을 적어 주세요.")
        if len(value) > 80:
            raise HTTPException(status_code=422, detail=f"{label}은 80자 이내로 적어 주세요.")
        if any(character in value for character in "\r\n{}[]<>"):
            raise HTTPException(status_code=422, detail=f"{label}에는 이름만 간단히 적어 주세요.")
        normalized[key] = value
    return normalized


def _generation_aspect_ratio(template: PromptTemplate, provider_options: dict[str, object]) -> str:
    requested = str(provider_options.get("aspect_ratio") or "").strip()
    if requested in ALLOWED_IMAGE_ASPECT_RATIOS:
        return requested

    template_ratio = str(template.aspect_ratio or "").strip()
    if template_ratio in ALLOWED_IMAGE_ASPECT_RATIOS:
        return template_ratio

    return "4:3"


async def _create_photo_for_job(
    db: AsyncSession,
    *,
    job: ImageGenerationJob,
    result_url: str,
    current_user_id: UUID,
    source_type: str = "ai_generated",
    source_photo_ids: list[str] | None = None,
) -> Photo:
    existing_photo_result = await db.execute(
        select(Photo).where(Photo.generation_job_id == job.id).order_by(Photo.created_at.asc()).limit(1)
    )
    existing_photo = existing_photo_result.scalar_one_or_none()
    if existing_photo:
        job.photo_id = existing_photo.id
        job.result_url = existing_photo.edited_url or existing_photo.original_url
        job.status = "succeeded"
        return existing_photo

    expires_at, retention_days = photo_retention_values()
    photo = Photo(
        user_id=current_user_id,
        session_id=None,
        original_url=result_url,
        title="AI 사진보정" if source_type == "ai_retouch" else "AI 이미지",
        topic="AI 사진보정" if source_type == "ai_retouch" else "AI 이미지",
        source_type=source_type,
        prompt_template_id=job.template_id,
        generation_job_id=job.id,
        generation_snapshot={
            "prompt": job.prompt,
            "provider": job.provider,
            "provider_model": job.provider_model,
            "variable_values": job.variable_values,
            "source_photo_id": str(job.source_photo_id) if job.source_photo_id else None,
            "source_photo_ids": source_photo_ids or job.source_photo_ids,
        },
        expires_at=expires_at,
        retention_days=retention_days,
    )
    db.add(photo)
    await db.flush()
    job.photo_id = photo.id
    job.result_url = result_url
    job.status = "succeeded"
    return photo


async def _sync_kie_generation_job(db: AsyncSession, job: ImageGenerationJob) -> bool:
    """Synchronize a processing Kie job once. Returns True when terminal."""
    if job.status != "processing" or job.provider != "kie" or not job.provider_task_id:
        return True

    state, image_url, error_message = await get_kie_task_result(job.provider_task_id)
    if state == "success" and image_url:
        job_id = job.id
        result_url: str | None = None
        try:
            await _lock_generation_result(db, job.id)
            await db.refresh(job)
            if job.status != "processing" or job.photo_id:
                return True

            existing_photo_result = await db.execute(
                select(Photo).where(Photo.generation_job_id == job.id).order_by(Photo.created_at.asc()).limit(1)
            )
            existing_photo = existing_photo_result.scalar_one_or_none()
            if existing_photo:
                job.photo_id = existing_photo.id
                job.result_url = existing_photo.edited_url or existing_photo.original_url
                job.status = "succeeded"
                await db.commit()
                await db.refresh(job)
                return True

            result_url = await persist_generated_image(
                user_id=job.user_id,
                prompt=job.prompt,
                result=ImageProviderResult(image_url=image_url),
            )
            result_owner_id = job.user_id
            template = await db.get(PromptTemplate, job.template_id)
            category = await db.get(Category, template.category_id) if template and template.category_id else None
            source_type = "ai_retouch" if category and category.kind == "retouch" else "ai_generated"
            await _create_photo_for_job(
                db,
                job=job,
                result_url=result_url,
                current_user_id=job.user_id,
                source_type=source_type,
                source_photo_ids=job.source_photo_ids,
            )
            if template:
                template.usage_count += 1
            usage_result = await db.execute(
                select(TemplateUsageEvent.id).where(TemplateUsageEvent.job_id == job.id).limit(1)
            )
            if usage_result.scalar_one_or_none() is None:
                db.add(TemplateUsageEvent(template_id=job.template_id, user_id=job.user_id, job_id=job.id))
            await db.commit()
            await db.refresh(job)
        except Exception as exc:
            await db.rollback()
            if result_url:
                _remove_local_upload(result_url, result_owner_id)
            failed_job = await db.get(ImageGenerationJob, job_id)
            if failed_job:
                failed_job.status = "failed"
                failed_job.error_message = str(exc)
                await db.commit()
                await db.refresh(failed_job)
            logger.exception("Failed to persist Kie generation result: job_id=%s", job_id)
        return True

    if state == "fail":
        job.status = "failed"
        job.error_message = error_message or "Image generation failed"
        await db.commit()
        await db.refresh(job)
        return True

    return False


async def _poll_kie_generation_job(job_id: UUID) -> None:
    """Keep Kie jobs moving even if the user's browser tab is closed."""
    for _attempt in range(KIE_SERVER_MAX_POLLS):
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(ImageGenerationJob).where(ImageGenerationJob.id == job_id))
            job = result.scalar_one_or_none()
            if not job or job.status != "processing":
                return
            try:
                if await _sync_kie_generation_job(db, job):
                    return
            except httpx.HTTPError as exc:
                logger.warning("Transient Kie polling error: job_id=%s error=%s", job_id, exc)
            except Exception:
                logger.exception("Unexpected Kie polling error: job_id=%s", job_id)
        await anyio.sleep(KIE_SERVER_POLL_SECONDS)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ImageGenerationJob).where(ImageGenerationJob.id == job_id))
        job = result.scalar_one_or_none()
        if job and job.status == "processing":
            job.status = "failed"
            job.error_message = "Image generation timed out"
            await db.commit()


async def _enforce_generation_limit(db: AsyncSession, user_id: UUID) -> None:
    if not settings.IMAGE_GENERATION_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="지금은 AI 이미지 만들기가 잠시 쉬고 있어요. 조금 뒤 다시 시도해 주세요.",
        )

    provider_allowlist = {item.strip().lower() for item in settings.IMAGE_PROVIDER_ALLOWLIST.split(",") if item.strip()}
    if provider_allowlist and settings.IMAGE_PROVIDER.strip().lower() not in provider_allowlist:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="현재 사용할 수 없는 이미지 생성 방식이에요. 관리자에게 문의해 주세요.",
        )

    model_allowlist = {item.strip() for item in settings.IMAGE_MODEL_ALLOWLIST.split(",") if item.strip()}
    if model_allowlist and settings.IMAGE_DEFAULT_MODEL.strip() not in model_allowlist:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="현재 사용할 수 없는 이미지 모델이에요. 관리자에게 문의해 주세요.",
        )

    cooldown_seconds = int(settings.IMAGE_GENERATION_COOLDOWN_SECONDS or 0)
    if cooldown_seconds > 0:
        cooldown_start = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=cooldown_seconds)
        recent_result = await db.execute(
            select(ImageGenerationJob.id).where(
                ImageGenerationJob.user_id == user_id,
                ImageGenerationJob.created_at >= cooldown_start,
            ).limit(1)
        )
        if recent_result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="이미지를 만들고 있어요. 잠시만 기다렸다가 다시 눌러 주세요.",
            )

    limit = int(settings.IMAGE_GENERATION_DAILY_LIMIT or 0)
    if limit <= 0:
        return

    window_start = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
    result = await db.execute(
        select(func.count(ImageGenerationJob.id)).where(
            ImageGenerationJob.user_id == user_id,
            ImageGenerationJob.created_at >= window_start,
            ImageGenerationJob.status.in_(("processing", "succeeded")),
        )
    )
    used = int(result.scalar_one() or 0)
    if used >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="오늘 만들 수 있는 AI 이미지 수를 모두 사용했어요. 내일 다시 만들어 볼까요?",
        )


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    kind: str | None = Query(default=None),
):
    query = select(Category).where(Category.is_active.is_(True))
    if kind:
        query = query.where(Category.kind == kind)
    result = await db.execute(query.order_by(Category.sort_order.asc(), Category.name.asc()))
    return result.scalars().all()


@router.get("/prompt-templates", response_model=list[PromptTemplateResponse])
async def list_prompt_templates(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    category_id: UUID | None = None,
    recommended: bool | None = None,
    kind: str | None = Query(default=None),
):
    query = (
        select(PromptTemplate)
        .options(selectinload(PromptTemplate.category))
        .where(PromptTemplate.is_public.is_(True), PromptTemplate.is_active.is_(True))
    )
    if category_id:
        query = query.where(PromptTemplate.category_id == category_id)
    if kind:
        query = query.join(Category, PromptTemplate.category_id == Category.id).where(Category.kind == kind)
    if recommended is not None:
        query = query.where(PromptTemplate.is_recommended == recommended)
    result = await db.execute(
        query.order_by(
            PromptTemplate.is_recommended.desc(),
            PromptTemplate.usage_count.desc(),
            PromptTemplate.updated_at.desc(),
        )
    )
    return result.scalars().all()


@router.get("/prompt-templates/{template_id}", response_model=PromptTemplateResponse)
async def get_prompt_template(
    template_id: UUID,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(PromptTemplate)
        .options(selectinload(PromptTemplate.category))
        .where(
            PromptTemplate.id == template_id,
            PromptTemplate.is_public.is_(True),
            PromptTemplate.is_active.is_(True),
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("/creative-assets", response_model=list[CreativeAssetResponse])
async def list_creative_assets(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    asset_type: str | None = None,
):
    query = select(CreativeAsset).where(CreativeAsset.is_public.is_(True), CreativeAsset.is_active.is_(True))
    if asset_type:
        query = query.where(CreativeAsset.asset_type == asset_type)
    result = await db.execute(query.order_by(CreativeAsset.asset_type.asc(), CreativeAsset.sort_order.asc()))
    return result.scalars().all()


@router.post(
    "/image-generations",
    response_model=ImageGenerationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(10, 60))],
)
async def create_image_generation(
    request: Request,
    background_tasks: BackgroundTasks,
    payload: ImageGenerationRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    require_photo_processing_consent(current_user)
    template_result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == payload.template_id,
            PromptTemplate.is_public.is_(True),
            PromptTemplate.is_active.is_(True),
        )
    )
    template = template_result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    category = await db.get(Category, template.category_id) if template.category_id else None
    template_kind = category.kind if category else "template"
    all_source_photo_ids = []
    if payload.source_photo_id:
        all_source_photo_ids.append(payload.source_photo_id)
    for item in payload.source_photo_ids:
        if item not in all_source_photo_ids:
            all_source_photo_ids.append(item)
    primary_source_photo_id = payload.source_photo_id or (all_source_photo_ids[0] if all_source_photo_ids else None)

    if template.requires_source_photo and not all_source_photo_ids:
        raise HTTPException(status_code=422, detail="먼저 AI 이미지에 넣을 인물 사진을 올려 주세요.")
    if template_kind == "retouch" and settings.IMAGE_PROVIDER.strip().lower() != "kie":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI사진보정은 현재 Kie.ai 방식에서만 사용할 수 있어요. 관리자에게 설정을 확인해 주세요.",
        )
    version = None
    if payload.version_id:
        version_result = await db.execute(
            select(PromptTemplateVersion).where(
                PromptTemplateVersion.id == payload.version_id,
                PromptTemplateVersion.template_id == template.id,
            )
        )
        version = version_result.scalar_one_or_none()
    if version is None:
        version = await _latest_version(db, template.id)

    variable_values = _validate_character_concept_values(
        template,
        _merge_values(template, payload.variable_values),
    )
    base_prompt = version.base_prompt if version else template.base_prompt
    prompt = render_prompt(base_prompt, variable_values)
    source_image_url = None
    source_image_urls: list[str] = []
    source_image_file_path: Path | None = None
    source_image_file_paths: list[Path] = []
    if all_source_photo_ids:
        photo_result = await db.execute(
            select(Photo).where(Photo.id.in_(all_source_photo_ids), Photo.user_id == current_user.id)
        )
        source_photos_by_id = {photo.id: photo for photo in photo_result.scalars().all()}
        if len(source_photos_by_id) != len(all_source_photo_ids):
            raise HTTPException(status_code=404, detail="Source photo not found")

        for source_id in all_source_photo_ids:
            source_photo = source_photos_by_id[source_id]
            source_path = _resolve_local_upload_path(source_photo.original_url, current_user.id)
            if source_photo.original_url.startswith("/uploads/") and source_path is None:
                raise HTTPException(status_code=404, detail="Source photo file not found")
            source_url = _absolute_public_url(source_photo.original_url, request)
            source_image_urls.append(source_url)
            if source_path:
                source_image_file_paths.append(source_path)

        source_image_url = source_image_urls[0]
        source_image_file_path = source_image_file_paths[0] if source_image_file_paths else None
        template_labels = template.locale_labels or {}
        preserve_background = bool(template_labels.get("preserve_background"))
        allow_outfit_change = bool(template_labels.get("allow_outfit_change"))
        prompt += (
            "\nUse the uploaded reference photo as the main person reference. "
            "Keep the same person's facial identity, hairstyle, expression, pose, body proportions, and camera framing. "
        )
        if allow_outfit_change:
            prompt += (
                "The outfit may change, but create an original costume rather than copying an exact protected character design, logo, emblem, pattern, or signature prop. "
            )
        else:
            prompt += "Keep the person's original clothing cues as much as possible. "
        if preserve_background:
            prompt += "Keep the original location, background structure, and composition unchanged. "
        else:
            prompt += "Change the background only as requested by the selected template. "
        prompt += "Do not replace the uploaded person with the named or a different character."
        if len(all_source_photo_ids) > 1:
            prompt += (
                "\nFor additional uploaded reference photos, use them only as people who should be naturally added or referenced in the scene. "
                "Match lighting, perspective, scale, and group-photo composition while preserving each person's identity."
            )

    safety_input = _safety_text_from_user_values(payload.variable_values)
    safety = screen_prompt(
        safety_input,
        template.negative_terms,
        allow_famous_character_reference=bool(
            (template.locale_labels or {}).get("character_inspired_mode")
        ),
    )
    if not safety.allowed:
        logger.info(
            "AI image generation blocked by safety: reason=%s template_id=%s user_id=%s",
            safety.reason,
            template.id,
            current_user.id,
        )
        await record_safety_event(
            db,
            user_id=current_user.id,
            template_id=template.id,
            reason=safety.reason,
            input_text=safety_input,
        )
        raise HTTPException(status_code=422, detail=safety.message)

    provider_options = dict(payload.provider_options)
    provider_options.pop("provider", None)
    provider_options.pop("model", None)
    provider_options["aspect_ratio"] = _generation_aspect_ratio(template, provider_options)
    lock_provider_options = dict(provider_options)
    lock_provider_options.pop("_client_request_id", None)
    provider = get_image_provider(settings.IMAGE_PROVIDER)
    provider_model = settings.IMAGE_DEFAULT_MODEL

    lock_payload = {
        "user_id": str(current_user.id),
        "template_id": str(template.id),
        "version_id": str(version.id) if version else None,
        "source_photo_id": str(primary_source_photo_id) if primary_source_photo_id else None,
        "source_photo_ids": [str(item) for item in all_source_photo_ids],
        "provider": provider.name,
        "provider_model": provider_model,
        "variable_values": variable_values,
        "provider_options": lock_provider_options,
    }
    lock_digest = hashlib.sha256(json.dumps(lock_payload, sort_keys=True, default=str).encode("utf-8")).digest()
    lock_key = int.from_bytes(lock_digest[:8], "big", signed=True)
    await db.execute(select(func.pg_advisory_xact_lock(lock_key)))

    duplicate_result = await db.execute(
        select(ImageGenerationJob)
        .where(
            ImageGenerationJob.user_id == current_user.id,
            ImageGenerationJob.template_id == template.id,
            ImageGenerationJob.version_id == (version.id if version else None),
            ImageGenerationJob.source_photo_id == primary_source_photo_id,
            ImageGenerationJob.source_photo_ids == [str(item) for item in all_source_photo_ids],
            ImageGenerationJob.status.in_(("processing", "succeeded")),
            ImageGenerationJob.provider == provider.name,
            ImageGenerationJob.provider_model == provider_model,
            ImageGenerationJob.variable_values == variable_values,
            ImageGenerationJob.provider_options == provider_options,
        )
        .order_by(ImageGenerationJob.created_at.desc())
        .limit(1)
    )
    duplicate_job = duplicate_result.scalar_one_or_none()
    if duplicate_job:
        return ImageGenerationResponse(
            job_id=duplicate_job.id,
            status=duplicate_job.status,
            photo_id=duplicate_job.photo_id,
            result_url=duplicate_job.result_url,
            message="이미 같은 이미지를 만들고 있어요. 완료될 때까지 잠시만 기다려 주세요.",
        )

    active_window_start = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=20)
    active_duplicate_result = await db.execute(
        select(ImageGenerationJob)
        .where(
            ImageGenerationJob.user_id == current_user.id,
            ImageGenerationJob.template_id == template.id,
            ImageGenerationJob.source_photo_id == primary_source_photo_id,
            ImageGenerationJob.source_photo_ids == [str(item) for item in all_source_photo_ids],
            ImageGenerationJob.status == "processing",
            ImageGenerationJob.provider == provider.name,
            ImageGenerationJob.provider_model == provider_model,
            ImageGenerationJob.created_at >= active_window_start,
        )
        .order_by(ImageGenerationJob.created_at.desc())
        .limit(1)
    )
    active_duplicate_job = active_duplicate_result.scalar_one_or_none()
    if active_duplicate_job:
        duplicate_message = (
            "이미 보정하고 있어요. 같은 사진은 한 번만 처리할게요."
            if template_kind == "retouch"
            else "이미 이미지를 만들고 있어요. 같은 사진은 한 번만 처리할게요."
        )
        return ImageGenerationResponse(
            job_id=active_duplicate_job.id,
            status=active_duplicate_job.status,
            photo_id=active_duplicate_job.photo_id,
            result_url=active_duplicate_job.result_url,
            message=duplicate_message,
        )

    await _enforce_generation_limit(db, current_user.id)

    if provider.name == "kie" and source_image_url and not source_image_file_path and _is_loopback_url(source_image_url):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "로컬 주소라 AI가 업로드 사진을 읽을 수 없어요. "
                "운영 서버에서 테스트하거나 PUBLIC_API_URL을 외부에서 접근 가능한 HTTPS 주소로 설정해 주세요."
            ),
        )
    job = ImageGenerationJob(
        user_id=current_user.id,
        template_id=template.id,
        version_id=version.id if version else None,
        source_photo_id=primary_source_photo_id,
        source_photo_ids=[str(item) for item in all_source_photo_ids],
        status="processing",
        provider=provider.name,
        provider_model=provider_model,
        prompt=prompt,
        variable_values=variable_values,
        provider_options=provider_options,
    )
    db.add(job)
    await db.flush()
    await db.commit()
    await db.refresh(job)
    job_id = job.id

    result_url: str | None = None
    try:
        generation_options = {**provider_options, "model": provider_model}
        if provider.name == "kie" and source_image_file_path:
            generation_options["_source_image_file_path"] = str(source_image_file_path)
        if provider.name == "kie" and source_image_file_paths:
            generation_options["_source_image_file_paths"] = [str(path) for path in source_image_file_paths]
        if source_image_urls and not source_image_file_paths:
            generation_options["source_image_urls"] = source_image_urls
        provider_source_image_url = None if provider.name == "kie" and source_image_file_paths else source_image_url
        provider_result = await provider.generate(
            prompt=prompt,
            source_image_url=provider_source_image_url,
            options=generation_options,
        )
        job.provider_task_id = provider_result.provider_task_id
        if provider_result.provider_task_id and provider_result.metadata and provider_result.metadata.get("async_provider"):
            await db.commit()
            background_tasks.add_task(_poll_kie_generation_job, job.id)
            return ImageGenerationResponse(job_id=job.id, status="processing", message="예쁜 이미지를 만들고 있어요.")

        result_owner_id = current_user.id
        result_url = await persist_generated_image(user_id=current_user.id, prompt=prompt, result=provider_result)
        photo = await _create_photo_for_job(
            db,
            job=job,
            result_url=result_url,
            current_user_id=current_user.id,
            source_type="ai_retouch" if template_kind == "retouch" else "ai_generated",
            source_photo_ids=[str(item) for item in all_source_photo_ids],
        )
        template.usage_count += 1
        db.add(TemplateUsageEvent(template_id=template.id, user_id=current_user.id, job_id=job.id))
        await db.commit()
        return ImageGenerationResponse(
            job_id=job.id,
            status="succeeded",
            photo_id=photo.id,
            result_url=result_url,
            message="이미지가 완성되었어요.",
        )
    except Exception as exc:
        await db.rollback()
        if result_url:
            _remove_local_upload(result_url, result_owner_id)
        failed_job = await db.get(ImageGenerationJob, job_id)
        if failed_job:
            failed_job.status = "failed"
            failed_job.error_message = str(exc)
            await db.commit()
        logger.exception("Image generation failed: job_id=%s", job_id)
        return ImageGenerationResponse(
            job_id=job_id,
            status="failed",
            message="이미지를 만들지 못했어요. 다시 시도해 주세요.",
        )


@router.get("/image-generations/{job_id}", response_model=ImageGenerationJobResponse)
async def get_image_generation(
    job_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ImageGenerationJob).where(ImageGenerationJob.id == job_id, ImageGenerationJob.user_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Generation job not found")

    if job.status == "processing" and job.provider == "kie" and job.provider_task_id:
        await _sync_kie_generation_job(db, job)

    return job


@admin_router.get("/categories", response_model=list[CategoryResponse])
async def admin_list_categories(
    _teacher: RequireTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Category).order_by(Category.kind.asc(), Category.sort_order.asc()))
    return result.scalars().all()


@admin_router.post("/categories", response_model=CategoryResponse, status_code=201)
async def admin_create_category(
    payload: CategoryCreate,
    _teacher: RequireTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = Category(**payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@admin_router.put("/categories/{category_id}", response_model=CategoryResponse)
async def admin_update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    _teacher: RequireTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.get(Category, category_id)
    if not item:
        raise HTTPException(status_code=404, detail="Category not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return item


@admin_router.get("/prompt-templates", response_model=list[PromptTemplateResponse])
async def admin_list_templates(
    _manager: RequireTemplateManager,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(PromptTemplate).options(selectinload(PromptTemplate.category)).order_by(PromptTemplate.updated_at.desc())
    )
    return result.scalars().all()


@admin_router.post("/prompt-templates", response_model=PromptTemplateResponse, status_code=201)
async def admin_create_template(
    payload: PromptTemplateCreate,
    _manager: RequireTemplateManager,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = payload.model_dump()
    data["variables"] = [item.model_dump() for item in payload.variables]
    template = PromptTemplate(**data)
    db.add(template)
    await db.flush()
    db.add(
        PromptTemplateVersion(
            template_id=template.id,
            version_number=1,
            base_prompt=template.base_prompt,
            variables=template.variables,
            default_values=template.default_values,
            negative_terms=template.negative_terms,
        )
    )
    await db.commit()
    await db.refresh(template)
    return template


@admin_router.put("/prompt-templates/{template_id}", response_model=PromptTemplateResponse)
async def admin_update_template(
    template_id: UUID,
    payload: PromptTemplateUpdate,
    _manager: RequireTemplateManager,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    template = await db.get(PromptTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "variables" in update_data and payload.variables is not None:
        update_data["variables"] = [item.model_dump() for item in payload.variables]
    content_changed = any(key in update_data for key in {"base_prompt", "variables", "default_values", "negative_terms"})
    for key, value in update_data.items():
        setattr(template, key, value)

    if content_changed:
        latest = await _latest_version(db, template.id)
        db.add(
            PromptTemplateVersion(
                template_id=template.id,
                version_number=(latest.version_number + 1 if latest else 1),
                base_prompt=template.base_prompt,
                variables=template.variables,
                default_values=template.default_values,
                negative_terms=template.negative_terms,
            )
        )

    await db.commit()
    await db.refresh(template)
    return template


@admin_router.post("/prompt-templates/{template_id}/duplicate", response_model=PromptTemplateResponse, status_code=201)
async def admin_duplicate_template(
    template_id: UUID,
    _manager: RequireTemplateManager,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    source = await db.get(PromptTemplate, template_id)
    if not source:
        raise HTTPException(status_code=404, detail="Template not found")
    clone = PromptTemplate(
        category_id=source.category_id,
        name=f"{source.name} 복사본",
        description=source.description,
        thumbnail_url=source.thumbnail_url,
        base_prompt=source.base_prompt,
        variables=source.variables,
        default_values=source.default_values,
        negative_terms=source.negative_terms,
        recommended_age=source.recommended_age,
        locale_labels=source.locale_labels,
        is_public=False,
        is_active=True,
        is_recommended=False,
        example_image_url=source.example_image_url,
        requires_source_photo=source.requires_source_photo,
        aspect_ratio=source.aspect_ratio,
        visible_user_fields=source.visible_user_fields,
    )
    db.add(clone)
    await db.flush()
    db.add(
        PromptTemplateVersion(
            template_id=clone.id,
            version_number=1,
            base_prompt=clone.base_prompt,
            variables=clone.variables,
            default_values=clone.default_values,
            negative_terms=clone.negative_terms,
        )
    )
    await db.commit()
    await db.refresh(clone)
    return clone


@admin_router.patch("/prompt-templates/{template_id}/status", response_model=PromptTemplateResponse)
async def admin_update_template_status(
    template_id: UUID,
    payload: TemplateStatusUpdate,
    _manager: RequireTemplateManager,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    template = await db.get(PromptTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(template, key, value)
    await db.commit()
    await db.refresh(template)
    return template


@admin_router.get("/creative-assets", response_model=list[CreativeAssetResponse])
async def admin_list_assets(_teacher: RequireTeacher, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(CreativeAsset).order_by(CreativeAsset.asset_type.asc(), CreativeAsset.sort_order.asc()))
    return result.scalars().all()


@admin_router.post("/creative-assets", response_model=CreativeAssetResponse, status_code=201)
async def admin_create_asset(
    payload: CreativeAssetCreate,
    _teacher: RequireTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = CreativeAsset(**payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@admin_router.put("/creative-assets/{asset_id}", response_model=CreativeAssetResponse)
async def admin_update_asset(
    asset_id: UUID,
    payload: CreativeAssetUpdate,
    _teacher: RequireTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.get(CreativeAsset, asset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Asset not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return item


@admin_router.get("/adjustment-presets", response_model=list[AdjustmentPresetResponse])
async def admin_list_presets(_teacher: RequireTeacher, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(AdjustmentPreset).order_by(AdjustmentPreset.sort_order.asc()))
    return result.scalars().all()


@admin_router.post("/adjustment-presets", response_model=AdjustmentPresetResponse, status_code=201)
async def admin_create_preset(
    payload: AdjustmentPresetCreate,
    _teacher: RequireTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = AdjustmentPreset(**payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@admin_router.put("/adjustment-presets/{preset_id}", response_model=AdjustmentPresetResponse)
async def admin_update_preset(
    preset_id: UUID,
    payload: AdjustmentPresetUpdate,
    _teacher: RequireTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.get(AdjustmentPreset, preset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Preset not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return item


@admin_router.get("/template-usage", response_model=list[TemplateUsageResponse])
async def admin_template_usage(_teacher: RequireTeacher, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(
            PromptTemplate.id,
            PromptTemplate.name,
            PromptTemplate.usage_count,
            func.max(TemplateUsageEvent.created_at).label("last_used_at"),
        )
        .outerjoin(TemplateUsageEvent, TemplateUsageEvent.template_id == PromptTemplate.id)
        .group_by(PromptTemplate.id, PromptTemplate.name, PromptTemplate.usage_count)
        .order_by(PromptTemplate.usage_count.desc(), PromptTemplate.name.asc())
    )
    return [
        TemplateUsageResponse(
            template_id=row[0],
            template_name=row[1],
            usage_count=row[2],
            last_used_at=row[3],
        )
        for row in result.all()
    ]


@admin_router.get("/safety-events")
async def admin_safety_events(_teacher: RequireTeacher, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(SafetyEvent).order_by(SafetyEvent.created_at.desc()).limit(100))
    return result.scalars().all()
