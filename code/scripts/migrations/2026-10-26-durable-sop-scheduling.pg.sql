-- Stop ALL old operation-service workers before applying. Do not run against a
-- business database without deployment review. Idempotent migration; no replay.
BEGIN;
ALTER TABLE sop_execution ADD COLUMN IF NOT EXISTS steps_snapshot JSONB;
ALTER TABLE sop_execution ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;
ALTER TABLE sop_execution ADD COLUMN IF NOT EXISTS lease_token VARCHAR(36);
ALTER TABLE sop_execution ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ;
ALTER TABLE sop_execution ADD COLUMN IF NOT EXISTS action_started_at TIMESTAMPTZ;
UPDATE sop_execution SET status=3,
  error_message='SOP旧执行缺少持久化快照或截止时间，结果未知，已停止；请核查后创建新执行',
  execution_log=COALESCE(execution_log,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
    'step',current_step+1,'status','failed','error','SOP旧执行缺少持久化快照或截止时间，结果未知，已停止；请核查后创建新执行',
    'time',clock_timestamp())),
  lease_token=NULL,lease_until=NULL,action_started_at=NULL,next_run_at=NULL,update_time=clock_timestamp()
WHERE status IN (0,2) AND CASE WHEN jsonb_typeof(steps_snapshot)='array'
  THEN next_run_at IS NULL AND current_step<jsonb_array_length(steps_snapshot) AND error_message IS NULL
  ELSE true END;
CREATE INDEX IF NOT EXISTS idx_sop_execution_due ON sop_execution (next_run_at,id) WHERE status=0;
CREATE INDEX IF NOT EXISTS idx_sop_execution_lease ON sop_execution (lease_until,id) WHERE action_started_at IS NOT NULL;
COMMIT;
