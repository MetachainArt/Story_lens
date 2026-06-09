"""Add AI image templates, assets, and generation jobs.

Revision ID: 005
Revises: 004
Create Date: 2026-06-09 13:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("idx_categories_kind_active", "categories", ["kind", "is_active"])

    op.create_table(
        "prompt_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("thumbnail_url", sa.String(500), nullable=True),
        sa.Column("base_prompt", sa.Text(), nullable=False),
        sa.Column("variables", postgresql.JSONB(), nullable=False),
        sa.Column("default_values", postgresql.JSONB(), nullable=False),
        sa.Column("negative_terms", postgresql.JSONB(), nullable=False),
        sa.Column("recommended_age", sa.String(40), nullable=True),
        sa.Column("locale_labels", postgresql.JSONB(), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_recommended", sa.Boolean(), nullable=False),
        sa.Column("usage_count", sa.Integer(), nullable=False),
        sa.Column("example_image_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_prompt_templates_category", "prompt_templates", ["category_id"])
    op.create_index("idx_prompt_templates_public_active", "prompt_templates", ["is_public", "is_active"])
    op.create_index("idx_prompt_templates_recommended", "prompt_templates", ["is_recommended"])

    op.create_table(
        "prompt_template_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("base_prompt", sa.Text(), nullable=False),
        sa.Column("variables", postgresql.JSONB(), nullable=False),
        sa.Column("default_values", postgresql.JSONB(), nullable=False),
        sa.Column("negative_terms", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["template_id"], ["prompt_templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_prompt_template_versions_template",
        "prompt_template_versions",
        ["template_id", "version_number"],
    )

    op.create_table(
        "creative_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("asset_type", sa.String(40), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("asset_url", sa.String(500), nullable=True),
        sa.Column("preview_url", sa.String(500), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_creative_assets_type_active", "creative_assets", ["asset_type", "is_active"])

    op.create_table(
        "adjustment_presets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("css_filter", sa.String(500), nullable=False),
        sa.Column("values", postgresql.JSONB(), nullable=False),
        sa.Column("preview_url", sa.String(500), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "image_generation_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_photo_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("photo_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("provider_model", sa.String(100), nullable=False),
        sa.Column("provider_task_id", sa.String(200), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("variable_values", postgresql.JSONB(), nullable=False),
        sa.Column("provider_options", postgresql.JSONB(), nullable=False),
        sa.Column("result_url", sa.String(500), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["photo_id"], ["photos.id"]),
        sa.ForeignKeyConstraint(["source_photo_id"], ["photos.id"]),
        sa.ForeignKeyConstraint(["template_id"], ["prompt_templates.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["version_id"], ["prompt_template_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_image_generation_jobs_user_status", "image_generation_jobs", ["user_id", "status"])

    op.create_table(
        "template_usage_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(40), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["image_generation_jobs.id"]),
        sa.ForeignKeyConstraint(["template_id"], ["prompt_templates.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_template_usage_template_created", "template_usage_events", ["template_id", "created_at"])

    op.create_table(
        "safety_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reason", sa.String(120), nullable=False),
        sa.Column("input_text", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["template_id"], ["prompt_templates.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_safety_events_created", "safety_events", ["created_at"])

    op.add_column(
        "photos",
        sa.Column("source_type", sa.String(40), nullable=False, server_default="upload"),
    )
    op.add_column("photos", sa.Column("prompt_template_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("photos", sa.Column("generation_job_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("photos", sa.Column("generation_snapshot", postgresql.JSONB(), nullable=True))
    op.create_foreign_key("fk_photos_prompt_template_id", "photos", "prompt_templates", ["prompt_template_id"], ["id"])
    op.create_foreign_key("fk_photos_generation_job_id", "photos", "image_generation_jobs", ["generation_job_id"], ["id"])
    op.alter_column("photos", "source_type", server_default=None)


def downgrade() -> None:
    op.drop_constraint("fk_photos_generation_job_id", "photos", type_="foreignkey")
    op.drop_constraint("fk_photos_prompt_template_id", "photos", type_="foreignkey")
    op.drop_column("photos", "generation_snapshot")
    op.drop_column("photos", "generation_job_id")
    op.drop_column("photos", "prompt_template_id")
    op.drop_column("photos", "source_type")
    op.drop_index("idx_safety_events_created", table_name="safety_events")
    op.drop_table("safety_events")
    op.drop_index("idx_template_usage_template_created", table_name="template_usage_events")
    op.drop_table("template_usage_events")
    op.drop_index("idx_image_generation_jobs_user_status", table_name="image_generation_jobs")
    op.drop_table("image_generation_jobs")
    op.drop_table("adjustment_presets")
    op.drop_index("idx_creative_assets_type_active", table_name="creative_assets")
    op.drop_table("creative_assets")
    op.drop_index("idx_prompt_template_versions_template", table_name="prompt_template_versions")
    op.drop_table("prompt_template_versions")
    op.drop_index("idx_prompt_templates_recommended", table_name="prompt_templates")
    op.drop_index("idx_prompt_templates_public_active", table_name="prompt_templates")
    op.drop_index("idx_prompt_templates_category", table_name="prompt_templates")
    op.drop_table("prompt_templates")
    op.drop_index("idx_categories_kind_active", table_name="categories")
    op.drop_table("categories")
