"""Add multi-source photo references for AI retouch jobs.

Revision ID: 010
Revises: 009
Create Date: 2026-06-11 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "image_generation_jobs",
        sa.Column(
            "source_photo_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.alter_column("image_generation_jobs", "source_photo_ids", server_default=None)


def downgrade() -> None:
    op.drop_column("image_generation_jobs", "source_photo_ids")
