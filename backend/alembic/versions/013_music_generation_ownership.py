"""Bind new music provider tasks to their requesting user and photo.

Revision ID: 013
Revises: 012
Existing photo music URLs remain unchanged. Unbound legacy provider tasks are
intentionally not backfilled because their owner cannot be proven.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "music_generation_jobs",
        sa.Column("task_id", sa.String(255), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("photo_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("photos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("result_payload", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_music_generation_jobs_user_id", "music_generation_jobs", ["user_id"])
    op.create_index("ix_music_generation_jobs_photo_id", "music_generation_jobs", ["photo_id"])


def downgrade() -> None:
    op.drop_table("music_generation_jobs")
