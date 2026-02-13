"""Add session keywords and photo topic columns.

Revision ID: 002
Revises: 001
Create Date: 2026-02-13 14:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column(
            "keywords",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
    )
    op.add_column(
        "photos",
        sa.Column("topic", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("photos", "topic")
    op.drop_column("sessions", "keywords")
