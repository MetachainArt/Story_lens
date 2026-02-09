"""Filter endpoints.

@TASK P2-R3-T1 - Filters API
"""
from fastapi import APIRouter
from app.schemas.filter import FilterResponse
from app.core.deps import CurrentUser

router = APIRouter(prefix="/filters", tags=["filters"])

# Hardcoded filter presets (feeling-based filters)
FILTERS = [
    {
        "id": "warm",
        "name": "warm",
        "label": "따뜻한",
        "css_filter": "brightness(1.1) saturate(1.3) sepia(0.2)",
        "preview_url": None,
    },
    {
        "id": "cool",
        "name": "cool",
        "label": "시원한",
        "css_filter": "brightness(1.05) saturate(0.9) hue-rotate(15deg)",
        "preview_url": None,
    },
    {
        "id": "happy",
        "name": "happy",
        "label": "행복한",
        "css_filter": "brightness(1.2) saturate(1.4) contrast(1.1)",
        "preview_url": None,
    },
    {
        "id": "calm",
        "name": "calm",
        "label": "차분한",
        "css_filter": "brightness(0.95) saturate(0.8) contrast(0.95)",
        "preview_url": None,
    },
    {
        "id": "memory",
        "name": "memory",
        "label": "회상",
        "css_filter": "brightness(0.9) saturate(0.6) sepia(0.4) contrast(1.1)",
        "preview_url": None,
    },
]


@router.get("", response_model=list[FilterResponse])
async def get_filters(current_user: CurrentUser):
    """Get list of available filter presets.

    Returns hardcoded list of 5 feeling-based filters.
    Accessible by both teachers and students.
    preview_url is None - frontend will generate preview using CSS filter.
    """
    return FILTERS
