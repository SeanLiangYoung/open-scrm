import { describe, it, expect, vi } from 'vitest';
import { SopExecutionService } from './sop-execution.service';

describe('durable SOP trigger', () => {
  it('saves a frozen snapshot and database-based 365-day deadline without starting a local runner', async () => {
    const step = { stepName: '年后提醒', stepOrder: 1, stepType: 1, delayTime: 365, delayUnit: 'day', actionContent: { content: 'hello' } };
    const service = new SopExecutionService();
    const enqueue = vi.fn(async (row: any, steps: any[]) => ({ ...row, id: 7, stepsSnapshot: structuredClone(steps), nextRunAt: new Date('2027-01-01') }));
    const save = vi.fn(async (row: any) => ({ ...row, id: 7 }));
    Object.assign(service, {
      sopTemplateService: { getTemplate: async () => ({ id: 3, templateType: 1, status: 1, steps: [step] }) },
      executionRepository: { create: (value: any) => value, save },
      scheduleStore: { enqueue }
    });
    const result = await service.triggerExecution(2, { templateId: 3, targetType: 1, targetIds: [10] });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][1]).toEqual([step]);
    step.actionContent.content = 'changed';
    expect(result.executions[0].stepsSnapshot[0].actionContent.content).toBe('hello');
    expect(save).not.toHaveBeenCalled();
  });
});
