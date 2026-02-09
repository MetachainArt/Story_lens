"""Filter schemas.

@TASK P2-R3-T1 - Filters API
"""
from pydantic import BaseModel


class FilterResponse(BaseModel):
    """Schema for filter response."""
    id: str
    name: str
    label: str
    css_filter: str
    preview_url: str | None = None

    class Config:
        from_attributes = True
