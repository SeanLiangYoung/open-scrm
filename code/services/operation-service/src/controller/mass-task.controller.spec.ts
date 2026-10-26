import { describe, expect, it, vi } from 'vitest';
import { MassTaskController } from './mass-task.controller';

function setup() {
  const controller = new MassTaskController();
  const cancelTask = vi.fn(async () => ({ success: true }));
  Object.assign(controller, {
    ctx: { get: (name: string) => ({ 'x-corp-id': '2', 'x-user-id': '7' })[name] || '' },
    massTaskService: { cancelTask }
  });
  return { controller, cancelTask };
}

describe('mass task cancellation ID boundary', () => {
  it.each(['0', '-1', '1.2', '1e1', '0x10', ' 1', '1 ', '1junk', '9007199254740993', '9007199254740992', ''])
  ('rejects invalid path ID %j before calling the mutation service', async id => {
    const t = setup();
    await expect(t.controller.cancelTask(id)).rejects.toMatchObject({ status: 400 });
    expect(t.cancelTask).not.toHaveBeenCalled();
  });

  it.each(['1', String(Number.MAX_SAFE_INTEGER)])('passes valid exact ID %s and authenticated enterprise', async id => {
    const t = setup();
    expect(await t.controller.cancelTask(id)).toMatchObject({ success: true });
    expect(t.cancelTask).toHaveBeenCalledTimes(1);
    expect(t.cancelTask).toHaveBeenCalledWith(Number(id), 2);
  });
});
