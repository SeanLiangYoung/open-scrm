import { describe, expect, it, vi } from 'vitest';
import { SopController } from './sop.controller';

function setup(authenticated = true) {
  const controller = new SopController();
  const service = { batchCreateSteps: vi.fn(async () => []), getSteps: vi.fn(async () => []) };
  Object.assign(controller, {
    ctx: { get: (header: string) => authenticated ? ({ 'x-corp-id': '2', 'x-user-id': '7' } as any)[header] || '' : '' },
    sopTemplateService: service
  });
  return { controller, service };
}

describe('SOP step controller tenant propagation', () => {
  it('uses trusted company context for step replacement', async () => {
    const t = setup();
    const body: any = { templateId: 3, corpId: 99, steps: [] };
    await t.controller.batchCreateSteps(body);
    expect(t.service.batchCreateSteps).toHaveBeenCalledWith(body, 2);
  });
  it('uses trusted company context for step reads', async () => {
    const t = setup();
    await t.controller.getSteps('3');
    expect(t.service.getSteps).toHaveBeenCalledWith(3, 2);
  });
  it.each(['read', 'write'])('rejects unauthenticated step %s', async action => {
    const t = setup(false);
    await expect(action === 'read' ? t.controller.getSteps('3') : t.controller.batchCreateSteps({ templateId: 3, steps: [] })).rejects.toMatchObject({ status: 401 });
    expect(t.service.getSteps).not.toHaveBeenCalled();
    expect(t.service.batchCreateSteps).not.toHaveBeenCalled();
  });
  it.each(['2junk', '2e1', '0x2'])('rejects ambiguous company header %s', async value => {
    const t = setup();
    Object.assign(t.controller, { ctx: { get: (header: string) => header === 'x-corp-id' ? value : '7' } });
    await expect(t.controller.getSteps('3')).rejects.toMatchObject({ status: 401 });
    expect(t.service.getSteps).not.toHaveBeenCalled();
  });
  it('accepts validated state identities when gateway headers are absent', async () => {
    const t = setup(false);
    Object.assign(t.controller, { ctx: { get: () => '', state: { user: { corpId: '2', userId: '7' } } } });
    await t.controller.getSteps('3');
    expect(t.service.getSteps).toHaveBeenCalledWith(3, 2);
  });

});
