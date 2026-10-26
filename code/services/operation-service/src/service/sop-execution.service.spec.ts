import { afterEach, describe, expect, it, vi } from 'vitest';
import { SopExecutionService } from './sop-execution.service';

function setup(stepCount = 2, completed = 0) {
  const service = new SopExecutionService();
  let row: any = {
    id: 1,
    corpId: 2,
    templateId: 3,
    status: 0,
    currentStep: completed,
    totalSteps: stepCount,
    executionLog: [],
    customerId: 10,
    targetType: 1
  };
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    stepName: `步骤${i + 1}`,
    stepType: 1,
    delayTime: 1,
    delayUnit: 'minute',
    actionContent: { content: `message-${i + 1}` }
  }));
  const matches = (where: any) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && '_value' in value) {
        return (value as any)._value.includes(row[key]);
      }
      return row[key] === value;
    });
  const repository = {
    findOne: vi.fn(async ({ where }: any) => (matches(where) ? structuredClone(row) : null)),
    find: vi.fn(async ({ where }: any) => (matches(where) ? [structuredClone(row)] : [])),
    update: vi.fn(async (where: any, patch: any) => {
      if (!matches(where)) return { affected: 0 };
      row = { ...row, ...patch };
      return { affected: 1 };
    }),
    save: vi.fn(async (data: any) => {
      row = structuredClone(data);
      return data;
    })
  };
  Object.assign(service, {
    executionRepository: repository,
    sopTemplateService: { getTemplate: vi.fn(async () => ({ id: 3, status: 1, templateType: 1, steps })) },
    servicesConfig: { message: 'http://message', customer: 'http://customer' },
    httpService: { post: vi.fn(async () => ({ data: { success: true, data: { success: 1, failed: 0 } } })) }
  });
  return { service, steps, repository, row: () => row, http: (service as any).httpService };
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('SOP execution controls', () => {
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
    await expect((t.service as any).executeStep(t.row(), {
      stepType, actionContent: { messageType: 5, content: 'Mock only' }
    })).rejects.toThrow('消息服务未确认成功发送');
  });

  it('records a failed HTTP200 send without advancing or running the next step', async () => {
    vi.useFakeTimers();
    const t = setup(2);
    t.http.post.mockResolvedValueOnce({ data: { success: true, data: { success: 0, failed: 1 } } });
    const run = (t.service as any).executeSteps(1, t.steps);
    await vi.advanceTimersByTimeAsync(120_000);
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
    await (t.service as any).executeStep({
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
    const run = (t.service as any).executeSteps(1, t.steps);
    await vi.advanceTimersByTimeAsync(1);
    await t.service.controlExecution(2, 1, action);
    await vi.advanceTimersByTimeAsync(120_000);
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
    const run = (t.service as any).executeSteps(1, t.steps);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.http.post).toHaveBeenCalledTimes(1);
    await t.service.controlExecution(2, 1, 'pause');
    finish();
    await vi.advanceTimersByTimeAsync(120_000);
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
    await vi.advanceTimersByTimeAsync(120_000);
    expect(t.http.post).toHaveBeenCalledTimes(1);
    expect(t.http.post.mock.calls[0][1].content).toBe('message-2');
    expect(t.row().status).toBe(1);
    expect(t.row().currentStep).toBe(2);
  });

  it('waits the full duration of a 30-day step instead of overflowing the timer', async () => {
    vi.useFakeTimers();
    const t = setup(1);
    t.steps[0].delayTime = 30;
    t.steps[0].delayUnit = 'day';
    const run = (t.service as any).startSteps(1, t.steps);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(t.http.post).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30 * 86_400_000 - 1_001);
    expect(t.http.post).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await run;
    expect(t.http.post).toHaveBeenCalledTimes(1);
    expect(t.row().status).toBe(1);
  });

  it('does not send after cancellation during a long timer chunk', async () => {
    vi.useFakeTimers();
    const t = setup(1);
    t.steps[0].delayTime = 30;
    t.steps[0].delayUnit = 'day';
    const run = (t.service as any).startSteps(1, t.steps);
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
    const run = (t.service as any).startSteps(1, t.steps);
    await vi.advanceTimersByTimeAsync(60_000);
    await run;
    expect(t.row().status).toBe(3);
    expect(t.row().currentStep).toBe(0);
    expect(t.row().executionLog[0]).toMatchObject({ step: 1, status: 'failed' });
    expect(await t.service.controlExecution(2, 1, 'resume')).toMatchObject({ count: 0 });
    await (t.service as any).startSteps(1, t.steps);
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

  it('shares the runner guard across separate request service instances', async () => {
    vi.useFakeTimers();
    const t = setup(1);
    const other = new SopExecutionService();
    Object.assign(other, t.service);
    const first = (t.service as any).startSteps(1, t.steps);
    const second = (other as any).startSteps(1, t.steps);
    expect(first).toBe(second);
    await vi.advanceTimersByTimeAsync(60_000);
    await Promise.all([first, second]);
    expect(t.http.post).toHaveBeenCalledTimes(1);
  });

  it('starts the resumed runner even when the previous runner rejects its initial read', async () => {
    vi.useFakeTimers();
    const t = setup(1);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    let rejectRead!: (error: Error) => void;
    t.repository.findOne.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRead = reject; }));
    const old = (t.service as any).startSteps(1, t.steps).catch(() => {});
    await t.service.controlExecution(2, 1, 'pause');
    await t.service.controlExecution(2, 1, 'resume');
    rejectRead(new Error('temporary database read failure'));
    await old;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.http.post).toHaveBeenCalledTimes(1);
    expect(t.row().status).toBe(1);
    log.mockRestore();
  });

  it('does not change another company execution', async () => {
    const t = setup();
    expect(await t.service.controlExecution(99, 1, 'cancel')).toMatchObject({ count: 0 });
    expect(t.row().status).toBe(0);
  });

  it('does not launch duplicate actions when pause/resume races an existing worker', async () => {
    vi.useFakeTimers();
    const t = setup();
    const run = (t.service as any).startSteps(1, t.steps);
    await vi.advanceTimersByTimeAsync(1);
    await t.service.controlExecution(2, 1, 'pause');
    await t.service.controlExecution(2, 1, 'resume');
    expect(await t.service.controlExecution(2, 1, 'resume')).toMatchObject({ count: 0 });
    await vi.advanceTimersByTimeAsync(120_000);
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
    const run = (t.service as any).executeSteps(1, t.steps);
    await vi.advanceTimersByTimeAsync(60_000);
    await t.service.controlExecution(2, 1, 'cancel');
    finish();
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
      const run = (t.service as any).executeSteps(1, t.steps);
      await vi.advanceTimersByTimeAsync(60_000);
      await t.service.controlExecution(2, 1, action);
      fail(new Error('downstream unavailable'));
      await run;
      expect(t.row().status).toBe(action === 'pause' ? 2 : 3);
      expect(t.row().errorMessage).toBe('downstream unavailable');
      expect(t.row().executionLog).toEqual([
        expect.objectContaining({ status: 'failed', step: 1 })
      ]);
    }
  );
});
