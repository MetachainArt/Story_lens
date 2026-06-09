"""Add prompt template metadata fields.

Revision ID: 008
Revises: 007
Create Date: 2026-06-09 16:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "prompt_templates",
        sa.Column("requires_source_photo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "prompt_templates",
        sa.Column("aspect_ratio", sa.String(length=20), nullable=False, server_default="1:1"),
    )
    op.add_column(
        "prompt_templates",
        sa.Column(
            "visible_user_fields",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.alter_column("prompt_templates", "requires_source_photo", server_default=None)
    op.alter_column("prompt_templates", "aspect_ratio", server_default=None)
    op.alter_column("prompt_templates", "visible_user_fields", server_default=None)


def downgrade() -> None:
    op.drop_column("prompt_templates", "visible_user_fields")
    op.drop_column("prompt_templates", "aspect_ratio")
    op.drop_column("prompt_templates", "requires_source_photo")
