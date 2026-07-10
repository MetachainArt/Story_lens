"""Add photo-processing consent and retention metadata.

Revision ID: 012
Revises: 011
Create Date: 2026-07-10 17:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("privacy_consent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("privacy_policy_version", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "photos",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "photos",
        sa.Column("retention_days", sa.Integer(), nullable=True),
    )
    op.create_index("idx_photos_expires_at", "photos", ["expires_at"])


def downgrade() -> None:
    op.drop_index("idx_photos_expires_at", table_name="photos")
    op.drop_column("photos", "retention_days")
    op.drop_column("photos", "expires_at")
    op.drop_column("users", "privacy_policy_version")
    op.drop_column("users", "privacy_consent_at")
