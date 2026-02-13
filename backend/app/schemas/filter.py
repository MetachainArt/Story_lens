"""Filter schemas.

@TASK P2-R3-T1 - Filters API
"""

from pydantic import BaseModel, ConfigDict


class FilterResponse(BaseModel):
    """Schema for filter response."""

    id: str
    name: str
    label: str
    css_filter: str
    preview_url: str | None = None

    model_config = ConfigDict(from_attributes=True)
