"""Add version read snapshot columns.

Revision ID: 20260518_0019
Revises: 20260517_0018
Create Date: 2026-05-18 23:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260518_0019"
down_revision = "20260517_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bot_versions", sa.Column("asset_counts_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("bot_versions", sa.Column("scenario_validation_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("bot_versions", sa.Column("nlu_training_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    op.execute(
        """
        UPDATE bot_versions
        SET
            asset_counts_json = jsonb_build_object(
                'dialogs',
                jsonb_array_length(CASE WHEN jsonb_typeof(version_json->'dialogs') = 'array' THEN version_json->'dialogs' ELSE '[]'::jsonb END),
                'intents',
                (
                    SELECT count(*)::int
                    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(version_json->'dialogs') = 'array' THEN version_json->'dialogs' ELSE '[]'::jsonb END) AS dialog(value)
                    WHERE dialog.value->>'dialogType' = '1'
                ),
                'modules',
                (
                    SELECT count(*)::int
                    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(version_json->'dialogs') = 'array' THEN version_json->'dialogs' ELSE '[]'::jsonb END) AS dialog(value)
                    WHERE dialog.value->>'dialogType' = '0'
                ),
                'dialog_flow_graphs',
                jsonb_array_length(CASE WHEN jsonb_typeof(version_json->'dialog_flow_graphs') = 'array' THEN version_json->'dialog_flow_graphs' ELSE '[]'::jsonb END),
                'entities',
                jsonb_array_length(CASE WHEN jsonb_typeof(version_json->'entities') = 'array' THEN version_json->'entities' ELSE '[]'::jsonb END),
                'dictionary',
                jsonb_array_length(CASE WHEN jsonb_typeof(version_json->'dictionary') = 'array' THEN version_json->'dictionary' ELSE '[]'::jsonb END),
                'qa',
                jsonb_array_length(CASE WHEN jsonb_typeof(version_json->'faq_dialogs') = 'array' THEN version_json->'faq_dialogs' ELSE '[]'::jsonb END),
                'apis',
                jsonb_array_length(CASE WHEN jsonb_typeof(version_json->'apis') = 'array' THEN version_json->'apis' ELSE '[]'::jsonb END),
                'floating_buttons',
                jsonb_array_length(CASE WHEN jsonb_typeof(version_json->'floating_buttons') = 'array' THEN version_json->'floating_buttons' ELSE '[]'::jsonb END),
                'rules',
                jsonb_array_length(CASE WHEN jsonb_typeof(version_json->'rules') = 'array' THEN version_json->'rules' ELSE '[]'::jsonb END),
                'small_talk',
                jsonb_array_length(CASE WHEN jsonb_typeof(version_json->'small_talk') = 'array' THEN version_json->'small_talk' ELSE '[]'::jsonb END),
                'blacklists',
                jsonb_array_length(CASE WHEN jsonb_typeof(version_json->'blacklists') = 'array' THEN version_json->'blacklists' ELSE '[]'::jsonb END),
                'retraining_records',
                CASE
                    WHEN jsonb_typeof(version_json #> '{system_config,retraining_records}') = 'object'
                    THEN (SELECT count(*)::int FROM jsonb_object_keys(version_json #> '{system_config,retraining_records}'))
                    ELSE 0
                END
            ),
            scenario_validation_json = COALESCE(version_json #> '{system_config,scenario_validation}', '{}'::jsonb),
            nlu_training_json = COALESCE(version_json #> '{system_config,nlu_training}', '{}'::jsonb)
        WHERE version_json IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("bot_versions", "nlu_training_json")
    op.drop_column("bot_versions", "scenario_validation_json")
    op.drop_column("bot_versions", "asset_counts_json")
