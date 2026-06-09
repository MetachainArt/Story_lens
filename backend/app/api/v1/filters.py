"""Filter endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.session import get_db
from app.models.ai_templates import AdjustmentPreset
from app.schemas.filter import FilterResponse
from app.services.ai_defaults import ensure_ai_defaults

router = APIRouter(prefix="/filters", tags=["filters"])


@router.get("", response_model=list[FilterResponse])
async def get_filters(
    _current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get available feeling-based filter presets."""
    await ensure_ai_defaults(db)
    result = await db.execute(
        select(AdjustmentPreset)
        .where(AdjustmentPreset.is_public.is_(True), AdjustmentPreset.is_active.is_(True))
        .order_by(AdjustmentPreset.sort_order.asc(), AdjustmentPreset.label.asc())
    )
    presets = result.scalars().all()
    return [
        {
            "id": str(preset.id),
            "name": preset.name,
            "label": preset.label,
            "css_filter": preset.css_filter,
            "preview_url": preset.preview_url,
        }
        for preset in presets
    ]
