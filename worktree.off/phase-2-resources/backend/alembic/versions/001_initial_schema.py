"""Initial schema: users, sessions, photos, edit_history

Revision ID: 001
Revises:
Create Date: 2026-02-09 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create user_role enum type
    op.execute("CREATE TYPE user_role AS ENUM ('teacher', 'student')")

    # Create users table
    op.create_table('users',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('role', sa.Enum('teacher', 'student', name='user_role'), nullable=False),
    sa.Column('teacher_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
    sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    sa.ForeignKeyConstraint(['teacher_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_users_email', 'users', ['email'], unique=True)
    op.create_index('idx_users_teacher_id', 'users', ['teacher_id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create sessions table
    op.create_table('sessions',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('location', sa.String(length=255), nullable=True),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_sessions_user_id', 'sessions', ['user_id'], unique=False)

    # Create photos table
    op.create_table('photos',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('original_url', sa.String(length=500), nullable=False),
    sa.Column('edited_url', sa.String(length=500), nullable=True),
    sa.Column('title', sa.String(length=255), nullable=True),
    sa.Column('thumbnail_url', sa.String(length=500), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_photos_session_id', 'photos', ['session_id'], unique=False)
    op.create_index('idx_photos_user_id', 'photos', ['user_id'], unique=False)

    # Create edit_history table
    op.create_table('edit_history',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('photo_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('filter_name', sa.String(length=50), nullable=True),
    sa.Column('adjustments', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('crop_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    sa.ForeignKeyConstraint(['photo_id'], ['photos.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_edit_history_photo_id', 'edit_history', ['photo_id'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_edit_history_photo_id', table_name='edit_history')
    op.drop_table('edit_history')

    op.drop_index('idx_photos_user_id', table_name='photos')
    op.drop_index('idx_photos_session_id', table_name='photos')
    op.drop_table('photos')

    op.drop_index('idx_sessions_user_id', table_name='sessions')
    op.drop_table('sessions')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index('idx_users_teacher_id', table_name='users')
    op.drop_index('idx_users_email', table_name='users')
    op.drop_table('users')

    op.execute("DROP TYPE user_role")
