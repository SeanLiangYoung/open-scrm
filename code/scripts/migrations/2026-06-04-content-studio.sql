-- Content Studio tables for content-generation-service.
-- Safe to re-run (IF NOT EXISTS). Apply to existing scrm_dev volumes that
-- were created before these tables were added to init-db.pg.sql.
--
-- Usage (Docker Compose):
--   docker exec -i scrm-postgres psql -U postgres -d scrm_dev < code/scripts/migrations/2026-06-04-content-studio.sql

CREATE TABLE IF NOT EXISTS content_source (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  summary TEXT,
  keywords JSONB,
  tone VARCHAR(100),
  target_audience VARCHAR(255),
  kb_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  kb_query VARCHAR(500),
  kb_project_id VARCHAR(255),
  create_user_id BIGINT,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_content_source_corp_updated
  ON content_source (corp_id, update_time DESC);

CREATE TABLE IF NOT EXISTS generation_job (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  source_id BIGINT NOT NULL,
  channels JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  llm_model VARCHAR(100),
  prompt_version VARCHAR(50),
  kb_mode VARCHAR(20) NOT NULL DEFAULT 'off',
  kb_hits INT NOT NULL DEFAULT 0,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_generation_job_source_time
  ON generation_job (source_id, create_time DESC);

CREATE TABLE IF NOT EXISTS content_variant (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  job_id BIGINT NOT NULL,
  source_id BIGINT NOT NULL,
  channel VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  body TEXT,
  structured JSONB,
  quality_flags JSONB,
  version INT NOT NULL DEFAULT 1,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_content_variant_job ON content_variant (job_id);
CREATE INDEX IF NOT EXISTS idx_content_variant_source_channel
  ON content_variant (source_id, channel);

CREATE TABLE IF NOT EXISTS variant_publish_link (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  variant_id BIGINT NOT NULL,
  content_id BIGINT NOT NULL,
  platform VARCHAR(20) NOT NULL,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_variant_publish_link_variant
  ON variant_publish_link (corp_id, variant_id);
