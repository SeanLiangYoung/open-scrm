-- Content Studio: wiki material selection + compose status
-- Apply to existing databases that already have content_source from 2026-06-04 migration.

ALTER TABLE content_source
  ADD COLUMN IF NOT EXISTS kb_selected_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kb_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS compose_status VARCHAR(20) NOT NULL DEFAULT 'draft';
