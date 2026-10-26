import { Provide, Inject, Config, Scope, ScopeEnum } from '@midwayjs/core';
import { SopScheduleStore } from './sop-schedule-store.service';
import { SopActionService } from './sop-action.service';
import { SopExecutionEntity } from '../entity/sop-execution.entity';
import { validateSopAction } from '../util/sop-action-validation';

@Provide()
@Scope(ScopeEnum.Singleton)
export class SopScheduler {
  @Inject() scheduleStore!: SopScheduleStore;
  @Inject() actionService!: SopActionService;
  @Config('operation.sop') schedulerConfig!: { pollMs: number; leaseMs: number; maxConcurrent: number };
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private stopped = false;

  start(): void {
    if (this.timer) return;
    this.stopped = false;
    const poll = () => { this.tick().catch(error => console.error('SOP持久调度失败:', error)); };
    this.timer = setInterval(poll, this.options().pollMs);
    this.timer.unref?.();
    poll();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.running;
  }

  private options() {
    const bounded = (value: number, fallback: number, min: number, max: number) =>
      Number.isSafeInteger(value) && value >= min && value <= max ? value : fallback;
    return {
      pollMs: bounded(this.schedulerConfig?.pollMs, 1000, 100, 60000),
      leaseMs: bounded(this.schedulerConfig?.leaseMs, 90000, 300, 600000),
      maxConcurrent: bounded(this.schedulerConfig?.maxConcurrent, 10, 1, 100)
    };
  }

  async tick(): Promise<void> {
    if (this.stopped || this.running) return;
    this.running = this.runBatch();
    try { await this.running; } finally { this.running = undefined; }
  }

  private async runBatch(): Promise<void> {
    const { maxConcurrent, leaseMs } = this.options();
    await this.scheduleStore.recover(maxConcurrent);
    const executions = await this.scheduleStore.claim(maxConcurrent, leaseMs);
    const results = await Promise.allSettled(executions.map(execution => this.runOne(execution, leaseMs)));
    for (const result of results) if (result.status === 'rejected') console.error('SOP步骤持久化失败:', result.reason);
  }

  private async runOne(execution: SopExecutionEntity, leaseMs: number): Promise<void> {
    // Fail invalid snapshots before the irreversible action-start marker.
    try {
      if (!Array.isArray(execution.stepsSnapshot) || !Number.isInteger(execution.currentStep) ||
        execution.currentStep < 0 || execution.currentStep >= execution.stepsSnapshot.length) throw new Error('SOP快照进度无效');
      execution.stepsSnapshot.forEach(validateSopAction);
    } catch (error) {
      await this.scheduleStore.finish(execution, error as Error);
      return;
    }
    if (this.stopped || !await this.scheduleStore.markAction(execution)) {
      await this.scheduleStore.release(execution);
      return;
    }
    let renewing = false;
    const heartbeat = setInterval(() => {
      if (renewing) return;
      renewing = true;
      this.scheduleStore.renew(execution, leaseMs)
        .catch(error => console.error('SOP租约续期失败:', error))
        .finally(() => { renewing = false; });
    }, Math.max(100, Math.floor(leaseMs / 3)));
    heartbeat.unref?.();
    let error: Error | undefined;
    try { await this.actionService.executeStep(execution, execution.stepsSnapshot[execution.currentStep]); }
    catch (caught) { error = caught instanceof Error ? caught : new Error(String(caught)); }
    finally { clearInterval(heartbeat); }
    // A save failure leaves a marker for recovery; never relabel it as an action failure or replay it.
    await this.scheduleStore.finish(execution, error);
  }
}
