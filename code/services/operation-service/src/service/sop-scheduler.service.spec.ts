import { afterEach, describe, expect, it, vi } from 'vitest';
import { SopScheduler } from './sop-scheduler.service';

function setup() {
  const row: any = { id: '7', corpId: '2', targetType: 1, customerId: 10, status: 0, currentStep: 0,
    totalSteps: 1, leaseToken: 'token', stepsSnapshot: [{ stepName: 'send', stepType: 1, delayTime: 0, delayUnit: 'minute', actionContent: { content: 'hello' } }] };
  const events: string[] = [];
  const store = {
    recover: vi.fn(async () => {}), claim: vi.fn(async () => [row]),
    markAction: vi.fn(async () => { events.push('marker'); return true; }),
    renew: vi.fn(async () => true), release: vi.fn(async () => {}),
    finish: vi.fn(async () => { events.push('finish'); })
  };
  const action = { executeStep: vi.fn(async () => { events.push('effect'); }) };
  const scheduler = Object.assign(new SopScheduler(), { scheduleStore: store, actionService: action,
    schedulerConfig: { pollMs: 1000, leaseMs: 90000, maxConcurrent: 2 } });
  return { row, store, action, scheduler, events };
}
afterEach(() => vi.useRealTimers());
describe('durable SOP worker', () => {
  it('commits a marker before the effect and token-guarded progress afterward', async () => {
    const t = setup(); await t.scheduler.tick();
    expect(t.events).toEqual(['marker', 'effect', 'finish']);
    expect(t.store.finish).toHaveBeenCalledWith(t.row, undefined);
  });
  it('does not dispatch when pause, cancel, or lease fencing rejects action marker', async () => {
    const t = setup(); t.store.markAction.mockResolvedValue(false); await t.scheduler.tick();
    expect(t.action.executeStep).not.toHaveBeenCalled();
    expect(t.store.release).toHaveBeenCalledWith(t.row);
  });
  it('validation rejects corrupt stored actions without dispatching a downstream request', async () => {
    const t = setup(); t.row.stepsSnapshot[0].delayTime = -1; await t.scheduler.tick();
    expect(t.action.executeStep).not.toHaveBeenCalled();
    expect(t.store.finish).toHaveBeenCalledWith(t.row, expect.any(Error));
  });
  it('records downstream failure instead of advancing to the next action', async () => {
    const t = setup(); const error = new Error('unconfirmed send'); t.action.executeStep.mockRejectedValue(error);
    await t.scheduler.tick(); expect(t.store.finish).toHaveBeenCalledWith(t.row, error);
  });
  it('does not overlap polling while a downstream request is in flight', async () => {
    const t = setup(); let done!: () => void;
    t.action.executeStep.mockImplementation(() => new Promise<void>(resolve => { done = resolve; }));
    const first = t.scheduler.tick(); await vi.waitFor(() => expect(t.action.executeStep).toHaveBeenCalledTimes(1));
    await t.scheduler.tick(); expect(t.store.claim).toHaveBeenCalledTimes(1); done(); await first;
  });
  it('renews owned in-flight lease and stops renewal after completion', async () => {
    vi.useFakeTimers(); const t = setup(); let done!: () => void;
    t.action.executeStep.mockImplementation(() => new Promise<void>(resolve => { done = resolve; }));
    const running = t.scheduler.tick(); await vi.advanceTimersByTimeAsync(30000);
    expect(t.store.renew).toHaveBeenCalledTimes(1); done(); await running;
    await vi.advanceTimersByTimeAsync(90000); expect(t.store.renew).toHaveBeenCalledTimes(1);
  });
  it('does not queue overlapping heartbeat queries when database renewal is slow', async () => {
    vi.useFakeTimers(); const t = setup(); let done!: () => void; let renewed!: () => void;
    t.action.executeStep.mockImplementation(() => new Promise<void>(resolve => { done = resolve; }));
    t.store.renew.mockImplementation(() => new Promise<boolean>(resolve => { renewed = () => resolve(true); }));
    const running = t.scheduler.tick(); await vi.advanceTimersByTimeAsync(90000);
    expect(t.store.renew).toHaveBeenCalledTimes(1); renewed(); done(); await running;
  });
  it('starts bounded periodic polling and stops without starting more work', async () => {
    vi.useFakeTimers(); const t=setup(); t.store.claim.mockResolvedValue([]);
    t.scheduler.start(); t.scheduler.start(); await vi.advanceTimersByTimeAsync(2000);
    expect(t.store.claim).toHaveBeenCalledTimes(3); await t.scheduler.stop();
    await vi.advanceTimersByTimeAsync(3000); expect(t.store.claim).toHaveBeenCalledTimes(3);
  });
});
