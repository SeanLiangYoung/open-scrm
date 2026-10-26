import { Provide, Scope, ScopeEnum } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { SopExecutionEntity } from '../entity/sop-execution.entity';
import { sopDelayMs, validateSopAction } from '../util/sop-action-validation';

export const LEGACY_SOP_REASON = 'SOP旧执行缺少持久化快照或截止时间，结果未知，已停止；请核查后创建新执行';
export const UNKNOWN_SOP_REASON = 'SOP动作已开始但执行者租约失效，结果未知，禁止自动重放；请人工核查';

/** All deadlines and lease decisions use database time, never a process clock. */
@Provide()
@Scope(ScopeEnum.Singleton)
export class SopScheduleStore {
  @InjectEntityModel(SopExecutionEntity)
  executionRepository!: Repository<SopExecutionEntity>;

  private row(raw: Record<string, any>): SopExecutionEntity {
    const value: Record<string, any> = {};
    for (const [key, item] of Object.entries(raw)) value[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = item;
    return value as SopExecutionEntity;
  }

  async enqueue(value: Partial<SopExecutionEntity>, steps: any[]): Promise<SopExecutionEntity> {
    const snapshot = JSON.parse(JSON.stringify(steps));
    let failure: { step: number; stepName?: string; status: string; error: string } | undefined;
    for (let index = 0; index < snapshot.length; index++) {
      try { validateSopAction(snapshot[index]); }
      catch (error) { failure = { step: index + 1, stepName: snapshot[index]?.stepName, status: 'failed',
        error: error instanceof Error ? error.message : String(error) }; break; }
    }
    // Invalid persisted template content still creates inspectable failed history.
    const status = failure ? 3 : snapshot.length ? 0 : 1;
    const delay = status === 0 ? sopDelayMs(snapshot[0].delayTime, snapshot[0].delayUnit) : 0;
    const rows = await this.executionRepository.query(`
      WITH inserted AS (
        INSERT INTO sop_execution (corp_id, template_id, template_name, target_type, customer_id, group_id,
          current_step, total_steps, status, start_time, complete_time, execution_log, steps_snapshot, next_run_at, error_message)
        VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8::smallint,clock_timestamp(),
          CASE WHEN $8::smallint=1 THEN clock_timestamp() ELSE NULL END,$12::jsonb,$9::jsonb,
          CASE WHEN $8::smallint=0 THEN clock_timestamp()+$10::double precision*interval '1 millisecond' ELSE NULL END,$11)
        RETURNING *) SELECT * FROM inserted`,
      [value.corpId, value.templateId, value.templateName, value.targetType, value.customerId ?? null,
        value.groupId ?? null, snapshot.length, status, JSON.stringify(snapshot), delay, failure?.error.slice(0,500) ?? null,
        JSON.stringify(failure ? [{ ...failure, time: new Date().toISOString() }] : [])]);
    return this.row(rows[0]);
  }

  /** Bounded recovery also covers paused/cancelled interrupted requests. */
  async recover(limit: number): Promise<void> {
    await this.executionRepository.query(`
      WITH candidates AS (
        SELECT id FROM sop_execution WHERE
          (status IN (0,2) AND CASE WHEN jsonb_typeof(steps_snapshot)='array'
            THEN next_run_at IS NULL AND current_step<jsonb_array_length(steps_snapshot) ELSE true END
            AND action_started_at IS NULL)
          OR (lease_until <= clock_timestamp() AND action_started_at IS NOT NULL)
        ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED
      ), recovered AS (
        UPDATE sop_execution e SET status=3,
          error_message=CASE WHEN action_started_at IS NOT NULL THEN $2 WHEN steps_snapshot IS NOT NULL AND error_message IS NOT NULL THEN error_message ELSE $3 END,
          execution_log=COALESCE(execution_log,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
            'step',current_step+1,'status','failed','error',CASE WHEN action_started_at IS NOT NULL THEN $2 WHEN steps_snapshot IS NOT NULL AND error_message IS NOT NULL THEN error_message ELSE $3 END,
            'time',clock_timestamp())),
          next_run_at=NULL,lease_token=NULL,lease_until=NULL,action_started_at=NULL,update_time=clock_timestamp()
        FROM candidates c WHERE e.id=c.id RETURNING e.id
      ) SELECT id FROM recovered`, [limit, UNKNOWN_SOP_REASON, LEGACY_SOP_REASON]);
  }

  async claim(limit: number, leaseMs: number): Promise<SopExecutionEntity[]> {
    const rows = await this.executionRepository.query(`
      WITH candidates AS (
        SELECT id FROM sop_execution WHERE status=0 AND next_run_at<=clock_timestamp()
          AND jsonb_typeof(steps_snapshot)='array' AND action_started_at IS NULL
          AND (lease_until IS NULL OR lease_until<=clock_timestamp())
        ORDER BY next_run_at,id LIMIT $1 FOR UPDATE SKIP LOCKED
      ), claimed AS (
        UPDATE sop_execution e SET lease_token=$2,lease_until=clock_timestamp()+$3::double precision*interval '1 millisecond',
          update_time=clock_timestamp() FROM candidates c WHERE e.id=c.id RETURNING e.*
      ) SELECT * FROM claimed`, [limit, randomUUID(), leaseMs]);
    return rows.map((row: Record<string, any>) => this.row(row));
  }

  async markAction(execution: SopExecutionEntity): Promise<boolean> {
    const rows = await this.executionRepository.query(`
      WITH marked AS (UPDATE sop_execution SET action_started_at=clock_timestamp(),update_time=clock_timestamp()
        WHERE id=$1 AND corp_id=$2 AND lease_token=$3 AND current_step=$4 AND status=0
          AND lease_until>clock_timestamp() AND action_started_at IS NULL RETURNING id) SELECT id FROM marked`,
      [execution.id, execution.corpId, execution.leaseToken, execution.currentStep]);
    return rows.length === 1;
  }

  async renew(execution: SopExecutionEntity, leaseMs: number): Promise<boolean> {
    const rows = await this.executionRepository.query(`
      WITH renewed AS (UPDATE sop_execution SET lease_until=clock_timestamp()+$4::double precision*interval '1 millisecond'
        WHERE id=$1 AND corp_id=$2 AND lease_token=$3 AND lease_until>clock_timestamp() RETURNING id)
      SELECT id FROM renewed`, [execution.id, execution.corpId, execution.leaseToken, leaseMs]);
    return rows.length === 1;
  }

  async release(execution: SopExecutionEntity): Promise<void> {
    await this.executionRepository.query(`UPDATE sop_execution SET lease_token=NULL,lease_until=NULL
      WHERE id=$1 AND corp_id=$2 AND lease_token=$3 AND action_started_at IS NULL`,
    [execution.id, execution.corpId, execution.leaseToken]);
  }

  async finish(execution: SopExecutionEntity, error?: Error): Promise<void> {
    const next = execution.currentStep + 1;
    const steps = execution.stepsSnapshot;
    // Validate all remaining delays before an action is attempted in the worker.
    const nextDelay = !error && next < steps.length ? sopDelayMs(steps[next].delayTime, steps[next].delayUnit) : 0;
    const entry = { step: next, stepName: steps[execution.currentStep]?.stepName,
      status: error ? 'failed' : 'success', ...(error ? { error: error.message } : {}) };
    await this.executionRepository.query(`UPDATE sop_execution SET
      current_step=CASE WHEN $5 THEN current_step ELSE current_step+1 END,
      status=CASE WHEN status<>0 THEN status WHEN $5 THEN 3 WHEN $6 THEN 1 ELSE 0 END,
      complete_time=CASE WHEN status=0 AND NOT $5 AND $6 THEN clock_timestamp() ELSE complete_time END,
      error_message=CASE WHEN $5 THEN $7 ELSE error_message END,
      execution_log=COALESCE(execution_log,'[]'::jsonb)||jsonb_build_array($8::jsonb||jsonb_build_object('time',clock_timestamp())),
      next_run_at=CASE WHEN $5 OR status=3 OR ($6 AND status<>2) THEN NULL
        ELSE clock_timestamp()+$9::double precision*interval '1 millisecond' END,
      lease_token=NULL,lease_until=NULL,action_started_at=NULL,update_time=clock_timestamp()
      WHERE id=$1 AND corp_id=$2 AND lease_token=$3 AND current_step=$4`,
    [execution.id, execution.corpId, execution.leaseToken, execution.currentStep,
      Boolean(error), next >= steps.length, error?.message.slice(0,500) ?? null, JSON.stringify(entry), nextDelay]);
  }

  async resume(id: number, corpId: number): Promise<{ affected: number }> {
    // A legacy/failed paused row must never acquire a fresh snapshot or replay.
    const rows = await this.executionRepository.query(`WITH candidate AS (
      SELECT id, CASE WHEN jsonb_typeof(steps_snapshot)='array'
        THEN current_step=jsonb_array_length(steps_snapshot) AND action_started_at IS NULL ELSE false END AS done,
        CASE WHEN jsonb_typeof(steps_snapshot)='array' THEN current_step>=0 AND current_step<jsonb_array_length(steps_snapshot)
          ELSE false END AS pending
      FROM sop_execution WHERE id=$1 AND corp_id=$2 AND status=2 FOR UPDATE
    ), resumed AS (
      UPDATE sop_execution e SET status=CASE WHEN c.done THEN 1 WHEN c.pending AND next_run_at IS NOT NULL THEN 0 ELSE 3 END,
        complete_time=CASE WHEN c.done THEN clock_timestamp() ELSE complete_time END,
        next_run_at=CASE WHEN c.done THEN NULL ELSE next_run_at END,
        error_message=CASE WHEN c.done OR (c.pending AND next_run_at IS NOT NULL) THEN error_message
          ELSE COALESCE(error_message,$3) END,
        update_time=clock_timestamp()
      FROM candidate c WHERE e.id=c.id RETURNING e.status) SELECT status FROM resumed`,
    [id, corpId, LEGACY_SOP_REASON]);
    return { affected: rows.filter((row: Record<string, any>) => [0, 1].includes(row.status)).length };
  }
}
