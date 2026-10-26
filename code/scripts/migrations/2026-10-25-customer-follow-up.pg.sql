-- Additive migration for existing PostgreSQL volumes. Fresh volumes use init-db.pg.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS customer_follow_up (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  follow_type SMALLINT NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  next_follow_time TIMESTAMP NULL,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_follow_up_corp_customer_time
  ON customer_follow_up (corp_id, customer_id, create_time DESC);
COMMIT;
