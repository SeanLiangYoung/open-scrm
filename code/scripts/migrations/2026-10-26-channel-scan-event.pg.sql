-- Apply before deploying transactional channel scan ingestion. Safe to apply twice.
CREATE TABLE IF NOT EXISTS channel_scan_event (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  channel_code_id INT NOT NULL,
  external_event_id VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_scan_event_identity
  ON channel_scan_event (corp_id, channel_code_id, external_event_id);
CREATE INDEX IF NOT EXISTS idx_channel_scan_event_expiry
  ON channel_scan_event (expires_at);
-- After the business transaction commits, separate autocommit cleanup reclaims
-- at most 1000 expired receipts/request using SKIP LOCKED (no channel lock held).
-- During idle periods operators may repeat this bounded maintenance statement:
-- DELETE FROM channel_scan_event WHERE id IN (
--   SELECT id FROM channel_scan_event WHERE expires_at <= clock_timestamp()
--   ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED
-- );
