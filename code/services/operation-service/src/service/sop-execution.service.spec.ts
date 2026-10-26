import { afterEach, describe, expect, it, vi } from 'vitest';
import { durableFixture } from '../../test/durable-sop-fixture';

function setup(stepCount = 2, completed = 0) {
 const steps = Array.from({length:stepCount},(_,i)=>({stepName:`步骤${i+1}`,stepType:1,delayTime:1,delayUnit:'minute',actionContent:{content:`message-${i+1}`}}));
 return durableFixture(steps,{currentStep:completed});
}
async function advance(t:ReturnType<typeof setup>,ms:number) { await vi.advanceTimersByTimeAsync(ms);await t.scheduler.tick(); }

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('SOP execution controls', () => {
  it.each([1, 3])('uses a stable execution/step message identity for action %s', async stepType => {
    const t=setup(2); const step={stepType,actionContent:{messageType:5,content:'Mock'}};
    await t.action.executeStep(t.row(),step); await t.action.executeStep(t.row(),step);
    await t.action.executeStep({...t.row(),currentStep:1},step);
    expect(t.http.post.mock.calls.map(call=>call[1].idempotencyKey)).toEqual(['sop:1:1','sop:1:1','sop:1:2']);
    expect(t.http.post.mock.calls[0][2]).toMatchObject({timeout:30000});
  });
  it.each([
    { stepType: 1, body: { success: true, data: { success: 0, failed: 1 } } },
    { stepType: 3, body: { success: true, data: { success: 0, failed: 1 } } },
    { stepType: 1, body: { success: false } },
    { stepType: 3, body: { success: false } },
    { stepType: 1, body: { success: true, data: { success: 1, failed: 1 } } },
    { stepType: 3, body: { success: true, data: { success: 1, failed: 1 } } },
    { stepType: 1, body: { success: true } },
    { stepType: 3, body: { success: true } }
  ])('rejects an unconfirmed or failed HTTP200 message response for step $stepType', async ({ stepType, body }) => {
    const t = setup(1);
    t.http.post.mockResolvedValueOnce({ data: body });
    await expect(t.action.executeStep(t.row(), {
      stepType, actionContent: { messageType: 5, content: 'Mock only' }
    })).rejects.toThrow('消息服务未确认成功发送');
  });

  it('records a failed HTTP200 send without advancing or running the next step', async () => {
    vi.useFakeTimers();
    const t = setup(2);
    t.http.post.mockResolvedValueOnce({ data: { success: true, data: { success: 0, failed: 1 } } });
    const run = t.scheduler.tick();
    await advance(t,60_000); await advance(t,60_000);
    await run;
    expect(t.row().status).toBe(3);
    expect(t.row().currentStep).toBe(0);
    expect(t.row().executionLog).toEqual([expect.objectContaining({ step: 1, status: 'failed' })]);
    expect(t.http.post).toHaveBeenCalledTimes(1);
  });

  it.each([
    { stepType: 1, sopTargetType: 1, messageTargetType: 1 },
    { stepType: 1, sopTargetType: 2, messageTargetType: 3 },
    { stepType: 3, sopTargetType: 1, messageTargetType: 1 },
    { stepType: 3, sopTargetType: 2, messageTargetType: 3 }
  ])('maps SOP target $sopTargetType to message target $messageTargetType for step $stepType', async ({ stepType, sopTargetType, messageTargetType }) => {
    const t = setup(1);
    await t.action.executeStep({
      ...t.row(), targetType: sopTargetType,
      customerId: sopTargetType === 1 ? 10 : null,
      groupId: sopTargetType === 2 ? 31 : null
    }, { stepType, actionContent: { content: 'explicit Mock message', messageType: 5 } });
    expect(t.http.post).toHaveBeenCalledTimes(1);
    expect(t.http.post.mock.calls[0][1]).toMatchObject({
      messageType: 5, targetType: messageTargetType, targetIds: sopTargetType === 1 ? 10 : 31
    });
  });

  it.each(['pause', 'cancel'])('does not send a delayed action after %s', async action => {
    vi.useFakeTimers();
    const t = setup();
    const run = t.scheduler.tick();
    await vi.advanceTimersByTimeAsync(1);
    await t.service.controlExecution(2, 1, action);
    await advance(t,60_000); await advance(t,60_000);
    await run;
    expect(t.http.post).not.toHaveBeenCalled();
    expect(t.row().status).toBe(action === 'pause' ? 2 : 3);
  });

  it('does not overwrite a pause received while an action is in flight', async () => {
    vi.useFakeTimers();
    const t = setup();
    let finish!: () => void;
    t.http.post.mockImplementationOnce(
      () =>
        new Promise<unknown>(resolve => {
          finish = () => resolve({ data: { success: true, data: { success: 1, failed: 0 } } });
        })
    );
    const run = t.scheduler.tick();
    await vi.advanceTimersByTimeAsync(60_000);
    const flight=t.scheduler.tick(); await vi.advanceTimersByTimeAsync(0);
    expect(t.http.post).toHaveBeenCalledTimes(1);
    await t.service.controlExecution(2, 1, 'pause');
    finish();
    await flight;
    await advance(t,60_000); await advance(t,60_000);
    await run;
    expect(t.row().status).toBe(2);
    expect(t.row().currentStep).toBe(1);
    expect(t.http.post).toHaveBeenCalledTimes(1);
  });

  it('continues after saved progress without replaying completed actions', async () => {
    vi.useFakeTimers();
    const t = setup(2, 1);
    await t.repository.update({ id: 1 }, { status: 2 });
    expect(await t.service.controlExecution(2, 1, 'resume')).toMatchObject({ count: 1 });
    await advance(t,60_000); await advance(t,60_000);
    expect(t.http.post).toHaveBeenCalledTimes(1);
    expect(t.http.post.mock.calls[0][1].content).toBe('message-2');
    expect(t.row().status).toBe(1);
    expect(t.row().currentStep).toBe(2);
  });

  it('waits for the persisted 30-day deadline instead of overflowing a timer', async () => {
    vi.useFakeTimers();
    const t = setup(1);
    t.steps[0].delayTime = 30;
    t.steps[0].delayUnit = 'day';
    t.row().stepsSnapshot=structuredClone(t.steps); t.row().nextRunAt=new Date(Date.now()+30*86_400_000);
    const run = t.scheduler.tick();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(t.http.post).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30 * 86_400_000 - 1_001);
    expect(t.http.post).not.toHaveBeenCalled();
    await advance(t,1);
    await run;
    expect(t.http.post).toHaveBeenCalledTimes(1);
    expect(t.row().status).toBe(1);
  });

  it('does not send after cancellation during a long persisted waiting period', async () => {
    vi.useFakeTimers();
    const t = setup(1);
    t.steps[0].delayTime = 30;
    t.steps[0].delayUnit = 'day';
    t.row().stepsSnapshot=structuredClone(t.steps); t.row().nextRunAt=new Date(Date.now()+30*86_400_000);
    const run = t.scheduler.tick();
    await vi.advanceTimersByTimeAsync(2_147_483_647);
    await t.service.controlExecution(2, 1, 'cancel');
    await vi.advanceTimersByTimeAsync(30 * 86_400_000);
    await run;
    expect(t.http.post).not.toHaveBeenCalled();
    expect(t.row().status).toBe(3);
  });

  it('does not restart a failed execution or resume a terminal record', async () => {
    vi.useFakeTimers();
    const t = setup();
    t.http.post.mockRejectedValueOnce(new Error('message unavailable'));
    const run = t.scheduler.tick();
    await advance(t,60_000);
    await run;
    expect(t.row().status).toBe(3);
    expect(t.row().currentStep).toBe(0);
    expect(t.row().executionLog[0]).toMatchObject({ step: 1, status: 'failed' });
    expect(await t.service.controlExecution(2, 1, 'resume')).toMatchObject({ count: 0 });
    await t.scheduler.tick();
    expect(t.http.post).toHaveBeenCalledTimes(1);
  });

  it('leaves a paused execution unchanged when its template is disabled', async () => {
    const t = setup();
    await t.repository.update({ id: 1 }, { status: 2 });
    (t.service.sopTemplateService.getTemplate as any).mockResolvedValueOnce({ status: 0 });
    await expect(t.service.controlExecution(2, 1, 'resume')).rejects.toThrow('已启用');
    expect(t.row().status).toBe(2);
    expect(t.http.post).not.toHaveBeenCalled();
  });

  it('shares the database claim guard across separate worker instances', async () => {
    vi.useFakeTimers();const t=setup(1);await vi.advanceTimersByTimeAsync(60_000);
    const other=Object.assign(new (t.scheduler.constructor as any)(),t.scheduler);
    await Promise.all([t.scheduler.tick(),other.tick()]);expect(t.http.post).toHaveBeenCalledTimes(1);
  });
  it('does not strand accepted resume when an earlier polling read failed', async () => {
    vi.useFakeTimers();const t=setup(1);t.store.claim.mockRejectedValueOnce(new Error('temporary read failure'));
    await expect(t.scheduler.tick()).rejects.toThrow('temporary read failure');
    await t.service.controlExecution(2,1,'pause');await t.service.controlExecution(2,1,'resume');
    await advance(t,60_000);expect(t.row().status).toBe(1);expect(t.http.post).toHaveBeenCalledTimes(1);
  });
  it('does not change another company execution', async () => {
    const t = setup();
    expect(await t.service.controlExecution(99, 1, 'cancel')).toMatchObject({ count: 0 });
    expect(t.row().status).toBe(0);
  });

  it('does not launch duplicate actions when pause/resume races an existing worker', async () => {
    vi.useFakeTimers();
    const t = setup();
    const run = t.scheduler.tick();
    await vi.advanceTimersByTimeAsync(1);
    await t.service.controlExecution(2, 1, 'pause');
    await t.service.controlExecution(2, 1, 'resume');
    expect(await t.service.controlExecution(2, 1, 'resume')).toMatchObject({ count: 0 });
    await advance(t,60_000); await advance(t,60_000);
    await run;
    expect(t.http.post).toHaveBeenCalledTimes(2);
    expect(t.row().currentStep).toBe(2);
    expect(t.row().status).toBe(1);
  });

  it('preserves cancellation while the last action is already in flight', async () => {
    vi.useFakeTimers();
    const t = setup(1);
    let finish!: () => void;
    t.http.post.mockImplementationOnce(
      () =>
        new Promise<unknown>(resolve => {
          finish = () => resolve({ data: { success: true, data: { success: 1, failed: 0 } } });
        })
    );
    const run = t.scheduler.tick();
    await vi.advanceTimersByTimeAsync(60_000);
    const flight=t.scheduler.tick(); await vi.advanceTimersByTimeAsync(0);
    await t.service.controlExecution(2, 1, 'cancel');
    finish();
    await flight;
    await run;
    expect(t.row().status).toBe(3);
    expect(t.row().currentStep).toBe(1);
  });

  it.each(['pause', 'cancel'])(
    'keeps failure evidence without overwriting %s received in flight',
    async action => {
      vi.useFakeTimers();
      const t = setup(1);
      let fail!: (error: Error) => void;
      t.http.post.mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            fail = reject;
          })
      );
      const run = t.scheduler.tick();
      await vi.advanceTimersByTimeAsync(60_000);
      const flight=t.scheduler.tick(); await vi.advanceTimersByTimeAsync(0);
      await t.service.controlExecution(2, 1, action);
      fail(new Error('downstream unavailable'));
      await flight;
      await run;
      expect(t.row().status).toBe(action === 'pause' ? 2 : 3);
      expect(t.row().errorMessage).toBe('downstream unavailable');
      expect(t.row().executionLog).toEqual([
        expect.objectContaining({ status: 'failed', step: 1 })
      ]);
    }
  );
});
