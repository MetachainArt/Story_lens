"""Generate GPT Image 2 preview thumbnails for AI template cards.

Run inside the API container so it can use the production KIE_API_KEY,
DATABASE_URL, and uploads volume:

    docker compose -f deploy/docker-compose.yml run --rm api \
      python scripts/generate_template_thumbnails.py --batch-size 5
"""

from __future__ import annotations

import argparse
import asyncio
import mimetypes
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

import anyio
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.ai_templates import Category, PromptTemplate
from app.services.ai_defaults import KID_TEMPLATE_CATEGORIES, ensure_ai_defaults
from app.services.image_generation import KieImageProvider, get_kie_task_result


APP_ROOT = Path(__file__).resolve().parents[1]
PREVIEW_ROOT = (APP_ROOT / "uploads" / "photos" / "template-previews").resolve()
DEFAULT_POLL_SECONDS = 5
DEFAULT_MAX_POLLS = 180


@dataclass(frozen=True)
class PreviewTask:
    template_id: UUID
    template_name: str
    task_id: str


def _preview_prompt(template: PromptTemplate) -> str:
    return f"""Create a polished sample thumbnail image for a Story Lens AI card.

Card name: {template.name}

Important:
- This is only a preview thumbnail, so do not require an uploaded reference photo.
- Use one original, friendly, non-famous sample child-like character or family-friendly mascot as the main subject.
- Do not copy celebrities, copyrighted characters, brand mascots, or real people.
- Keep the image safe for children: bright, warm, non-scary, non-violent, non-sexual.
- The thumbnail must clearly show what result this card will create.
- No UI mockup, no app screen, no placeholder card, no before/after split.

Card concept prompt:
{template.base_prompt}

Output style:
High-quality GPT Image 2 preview, colorful, charming, finished illustration/photo-poster look, clear composition, suitable for a card gallery thumbnail."""


async def _templates_needing_thumbnails(db: AsyncSession, *, force: bool, limit: int | None) -> list[PromptTemplate]:
    category_slugs = [slug for slug, *_rest in KID_TEMPLATE_CATEGORIES]
    query = (
        select(PromptTemplate)
        .join(Category, PromptTemplate.category_id == Category.id)
        .where(
            Category.slug.in_(category_slugs),
            PromptTemplate.is_public.is_(True),
            PromptTemplate.is_active.is_(True),
        )
        .order_by(Category.sort_order.asc(), PromptTemplate.is_recommended.desc(), PromptTemplate.name.asc())
    )
    if not force:
        query = query.where((PromptTemplate.thumbnail_url.is_(None)) | (PromptTemplate.thumbnail_url == ""))
    if limit:
        query = query.limit(limit)

    result = await db.execute(query)
    return list(result.scalars().all())


async def _start_preview_task(provider: KieImageProvider, template: PromptTemplate) -> PreviewTask:
    result = await provider.generate(
        prompt=_preview_prompt(template),
        source_image_url=None,
        options={
            "model": settings.IMAGE_DEFAULT_MODEL or "gpt-image-2",
            "aspect_ratio": template.aspect_ratio or "1:1",
            "resolution": "1K",
        },
    )
    if not result.provider_task_id:
        raise RuntimeError(f"Kie did not return a task id for {template.name}")
    return PreviewTask(template_id=template.id, template_name=template.name, task_id=result.provider_task_id)


async def _download_preview(task: PreviewTask, image_url: str) -> str:
    PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.get(image_url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "image/png").split(";", 1)[0].lower()
        extension = mimetypes.guess_extension(content_type) or ".png"
        if extension == ".jpe":
            extension = ".jpg"
        path = PREVIEW_ROOT / f"{task.template_id}{extension}"
        async with await anyio.open_file(path, "wb") as file:
            await file.write(response.content)
    return f"/uploads/photos/template-previews/{path.name}"


async def _wait_and_save(task: PreviewTask, *, poll_seconds: int, max_polls: int) -> bool:
    for _attempt in range(max_polls):
        state, image_url, error_message = await get_kie_task_result(task.task_id)
        if state == "success" and image_url:
            thumbnail_url = await _download_preview(task, image_url)
            async with AsyncSessionLocal() as db:
                template = await db.get(PromptTemplate, task.template_id)
                if template:
                    template.thumbnail_url = thumbnail_url
                    template.example_image_url = thumbnail_url
                    await db.commit()
            print(f"[ok] {task.template_name}: {thumbnail_url}", flush=True)
            return True
        if state == "fail":
            print(f"[fail] {task.template_name}: {error_message or 'generation failed'}", flush=True)
            return False
        await asyncio.sleep(poll_seconds)

    print(f"[timeout] {task.template_name}: task_id={task.task_id}", flush=True)
    return False


async def _process_batch(
    provider: KieImageProvider,
    templates: list[PromptTemplate],
    *,
    poll_seconds: int,
    max_polls: int,
) -> tuple[int, int]:
    started: list[PreviewTask] = []
    for template in templates:
        try:
            task = await _start_preview_task(provider, template)
            started.append(task)
            print(f"[start] {template.name}: task_id={task.task_id}", flush=True)
        except Exception as exc:
            print(f"[fail] {template.name}: {exc}", flush=True)

    results = await asyncio.gather(
        *(_wait_and_save(task, poll_seconds=poll_seconds, max_polls=max_polls) for task in started),
        return_exceptions=True,
    )
    success = sum(1 for item in results if item is True)
    failed = len(results) - success + (len(templates) - len(started))
    return success, failed


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=5, help="How many GPT Image 2 jobs to run at the same time.")
    parser.add_argument("--limit", type=int, default=None, help="Only generate this many missing thumbnails.")
    parser.add_argument("--force", action="store_true", help="Regenerate thumbnails even when one already exists.")
    parser.add_argument("--poll-seconds", type=int, default=DEFAULT_POLL_SECONDS)
    parser.add_argument("--max-polls", type=int, default=DEFAULT_MAX_POLLS)
    args = parser.parse_args()

    if not settings.KIE_API_KEY:
        raise RuntimeError("KIE_API_KEY is not configured")
    if args.batch_size < 1:
        raise RuntimeError("--batch-size must be at least 1")

    provider = KieImageProvider()
    async with AsyncSessionLocal() as db:
        await ensure_ai_defaults(db)
        templates = await _templates_needing_thumbnails(db, force=args.force, limit=args.limit)
        print(f"Generating thumbnails for {len(templates)} template(s).", flush=True)

        total_success = 0
        total_failed = 0
        for offset in range(0, len(templates), args.batch_size):
            batch = templates[offset : offset + args.batch_size]
            success, failed = await _process_batch(
                provider,
                batch,
                poll_seconds=args.poll_seconds,
                max_polls=args.max_polls,
            )
            total_success += success
            total_failed += failed

        print(f"Done. success={total_success} failed={total_failed}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
