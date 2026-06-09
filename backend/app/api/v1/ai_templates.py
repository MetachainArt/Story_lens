"""AI template management, creative assets, and image generation routes."""

from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...core.config import settings
from ...core.deps import CurrentUser, RequireTeacher, RequireTemplateManager
from ...db.session import get_db
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
from ...services.ai_defaults import ensure_ai_defaults
from ...services.image_generation import (
    ImageProviderResult,
    get_image_provider,
    get_kie_task_result,
    persist_generated_image,
    render_prompt,
)
from ...services.safety import record_safety_event, screen_prompt


router = APIRouter(tags=["ai-templates"])
admin_router = APIRouter(prefix="/admin", tags=["ai-admin"])


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


async def _create_photo_for_job(
    db: AsyncSession,
    *,
    job: ImageGenerationJob,
    result_url: str,
    current_user_id: UUID,
) -> Photo:
    photo = Photo(
        user_id=current_user_id,
        session_id=None,
        original_url=result_url,
        title="AI 이미지",
        topic="AI 이미지",
        source_type="ai_generated",
        prompt_template_id=job.template_id,
        generation_job_id=job.id,
        generation_snapshot={
            "prompt": job.prompt,
            "provider": job.provider,
            "provider_model": job.provider_model,
            "variable_values": job.variable_values,
        },
    )
    db.add(photo)
    await db.flush()
    job.photo_id = photo.id
    job.result_url = result_url
    job.status = "succeeded"
    return photo


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    kind: str | None = Query(default=None),
):
    await ensure_ai_defaults(db)
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
):
    await ensure_ai_defaults(db)
    query = (
        select(PromptTemplate)
        .options(selectinload(PromptTemplate.category))
        .where(PromptTemplate.is_public.is_(True), PromptTemplate.is_active.is_(True))
    )
    if category_id:
        query = query.where(PromptTemplate.category_id == category_id)
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
    await ensure_ai_defaults(db)
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
    await ensure_ai_defaults(db)
    query = select(CreativeAsset).where(CreativeAsset.is_public.is_(True), CreativeAsset.is_active.is_(True))
    if asset_type:
        query = query.where(CreativeAsset.asset_type == asset_type)
    result = await db.execute(query.order_by(CreativeAsset.asset_type.asc(), CreativeAsset.sort_order.asc()))
    return result.scalars().all()


@router.post("/image-generations", response_model=ImageGenerationResponse, status_code=status.HTTP_201_CREATED)
async def create_image_generation(
    payload: ImageGenerationRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await ensure_ai_defaults(db)
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

    variable_values = _merge_values(template, payload.variable_values)
    base_prompt = version.base_prompt if version else template.base_prompt
    prompt = render_prompt(base_prompt, variable_values)
    source_image_url = None
    if payload.source_photo_id:
        photo_result = await db.execute(
            select(Photo).where(Photo.id == payload.source_photo_id, Photo.user_id == current_user.id)
        )
        source_photo = photo_result.scalar_one_or_none()
        if not source_photo:
            raise HTTPException(status_code=404, detail="Source photo not found")
        if source_photo.original_url.startswith(("http://", "https://")):
            source_image_url = source_photo.original_url
        prompt += "\n원본 사진의 인물 특징은 최대한 유지하고, 스타일과 분위기만 자연스럽게 바꿔주세요."

    safety = screen_prompt(prompt, template.negative_terms)
    if not safety.allowed:
        await record_safety_event(
            db,
            user_id=current_user.id,
            template_id=template.id,
            reason=safety.reason,
            input_text=prompt,
        )
        raise HTTPException(status_code=422, detail=safety.message)

    provider = get_image_provider(str(payload.provider_options.get("provider") or settings.IMAGE_PROVIDER))
    provider_model = str(payload.provider_options.get("model") or settings.IMAGE_DEFAULT_MODEL)
    job = ImageGenerationJob(
        user_id=current_user.id,
        template_id=template.id,
        version_id=version.id if version else None,
        source_photo_id=payload.source_photo_id,
        status="processing",
        provider=provider.name,
        provider_model=provider_model,
        prompt=prompt,
        variable_values=variable_values,
        provider_options=payload.provider_options,
    )
    db.add(job)
    await db.flush()

    try:
        provider_result = await provider.generate(
            prompt=prompt,
            source_image_url=source_image_url,
            options={"model": provider_model, **payload.provider_options},
        )
    except httpx.HTTPError as exc:
        job.status = "failed"
        job.error_message = str(exc)
        await db.commit()
        return ImageGenerationResponse(
            job_id=job.id,
            status=job.status,
            message="이미지를 만들지 못했어요. 다시 시도해 주세요.",
        )

    job.provider_task_id = provider_result.provider_task_id
    if provider_result.provider_task_id and provider_result.metadata and provider_result.metadata.get("async_provider"):
        await db.commit()
        return ImageGenerationResponse(job_id=job.id, status="processing", message="예쁜 이미지를 만들고 있어요.")

    result_url = await persist_generated_image(user_id=current_user.id, prompt=prompt, result=provider_result)
    photo = await _create_photo_for_job(db, job=job, result_url=result_url, current_user_id=current_user.id)
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
        state, image_url, error_message = await get_kie_task_result(job.provider_task_id)
        if state == "success" and image_url:
            result_url = await persist_generated_image(
                user_id=current_user.id,
                prompt=job.prompt,
                result=ImageProviderResult(image_url=image_url),
            )
            await _create_photo_for_job(db, job=job, result_url=result_url, current_user_id=current_user.id)
            template = await db.get(PromptTemplate, job.template_id)
            if template:
                template.usage_count += 1
            db.add(TemplateUsageEvent(template_id=job.template_id, user_id=current_user.id, job_id=job.id))
            await db.commit()
            await db.refresh(job)
        elif state == "fail":
            job.status = "failed"
            job.error_message = error_message or "Image generation failed"
            await db.commit()
            await db.refresh(job)

    return job


@admin_router.get("/categories", response_model=list[CategoryResponse])
async def admin_list_categories(
    _teacher: RequireTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await ensure_ai_defaults(db)
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
    await ensure_ai_defaults(db)
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
    await ensure_ai_defaults(db)
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
    await ensure_ai_defaults(db)
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
    await ensure_ai_defaults(db)
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
