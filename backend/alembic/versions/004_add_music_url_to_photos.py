"""Add music_url column to photos for cross-device music playback.

Revision ID: 004
Revises: 003
Create Date: 2026-03-10 22:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "photos",
        sa.Column("music_url", sa.String(1000), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("photos", "music_url")
