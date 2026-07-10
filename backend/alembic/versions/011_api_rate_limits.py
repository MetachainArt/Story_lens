"""Add shared API rate limit buckets.

Revision ID: 011
Revises: 010
Create Date: 2026-06-12 14:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "api_rate_limits",
        sa.Column("bucket_key", sa.String(length=96), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("window_seconds", sa.Integer(), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("bucket_key"),
    )
    op.create_index(
        "idx_api_rate_limits_updated_at",
        "api_rate_limits",
        ["updated_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_api_rate_limits_updated_at", table_name="api_rate_limits")
    op.drop_table("api_rate_limits")
