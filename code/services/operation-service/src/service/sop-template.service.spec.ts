import { describe, expect, it, vi } from 'vitest';
import { SopTemplateService } from './sop-template.service';
import { SopTemplateEntity } from '../entity/sop-template.entity';
import { SopStepEntity } from '../entity/sop-step.entity';

function setup() {
  const service = new SopTemplateService();
  const template = { id: 3, corpId: 2, createUserId: 7, templateName: '原模板' };
  const templates = {
    findOne: vi.fn(async ({ where }: any) => where.id === 3 && where.corpId === 2 ? { ...template } : null),
    save: vi.fn(async (data: any) => data),
    delete: vi.fn(async ({ id, corpId }: any) => ({ affected: id === 3 && corpId === 2 ? 1 : 0 }))
  };
  let stepRows = [{ id: 4, templateId: 3, stepName: '原步骤' }];
  const steps = {
    find: vi.fn(async () => [{ id: 4, templateId: 3 }]),
    delete: vi.fn(async () => { stepRows = []; return { affected: 1 }; }),
    create: vi.fn((data: any) => data),
    save: vi.fn(async (data: any) => { stepRows = data; return data; })
  };
  const transactionRepositories = new Map<any, any>([[SopTemplateEntity, templates], [SopStepEntity, steps]]);
  const transaction = vi.fn(async (run: (manager: any) => Promise<any>) => {
    const snapshot = structuredClone(stepRows);
    try { return await run({ getRepository: (entity: any) => transactionRepositories.get(entity) }); }
    catch (error) { stepRows = snapshot; throw error; }
  });
  Object.assign(steps, { manager: { transaction } });
  Object.assign(service, { templateRepository: templates, stepRepository: steps });
  return { service, templates, steps, transaction, rows: () => stepRows };
}
const dto = () => ({ templateId: 3, steps: [{ stepOrder: 1, stepName: '欢迎', stepType: 1, actionContent: { content: 'hi' } }] });

describe('SOP template tenant boundary', () => {
  it('rolls back deleted steps if replacement save fails', async () => {
    const t = setup();
    t.steps.save.mockRejectedValueOnce(new Error('replacement constraint violation'));
    await expect(t.service.batchCreateSteps(dto(), 2)).rejects.toThrow('replacement constraint violation');
    expect(t.rows()).toEqual([{ id: 4, templateId: 3, stepName: '原步骤' }]);
    expect(t.transaction).toHaveBeenCalledTimes(1);
  });

  it('commits a replacement using repositories obtained from the transaction manager', async () => {
    const t = setup();
    await t.service.batchCreateSteps(dto(), 2);
    expect(t.transaction).toHaveBeenCalledTimes(1);
    expect(t.templates.findOne).toHaveBeenCalledWith({ where: { id: 3, corpId: 2 }, lock: { mode: 'pessimistic_write' } });
    expect(t.rows()).toEqual([expect.objectContaining({ templateId: 3, stepName: '欢迎' })]);
  });

  it('rejects another company replacing steps before deleting any data', async () => {
    const t = setup();
    await expect((t.service.batchCreateSteps as any)(dto(), 99)).rejects.toThrow('模板不存在');
    expect(t.steps.delete).not.toHaveBeenCalled();
    expect(t.steps.save).not.toHaveBeenCalled();
  });
  it('rejects another company reading steps', async () => {
    const t = setup();
    await expect((t.service.getSteps as any)(3, 99)).rejects.toThrow('模板不存在');
    expect(t.steps.find).not.toHaveBeenCalled();
  });
  it('allows the owner to replace steps while ignoring forged nested ownership and row IDs', async () => {
    const t = setup();
    const body = dto();
    Object.assign(body.steps[0], { id: 900, templateId: 80, status: 0 });
    await (t.service.batchCreateSteps as any)(body, 2);
    expect(t.steps.delete).toHaveBeenCalledWith({ templateId: 3 });
    expect(t.steps.save.mock.calls[0][0][0]).toMatchObject({ templateId: 3, stepName: '欢迎' });
    expect(t.steps.save.mock.calls[0][0][0]).not.toHaveProperty('id');
    expect(t.steps.save.mock.calls[0][0][0]).not.toHaveProperty('status');
  });
  it('does not let template updates overwrite company, identity, or creator', async () => {
    const t = setup();
    await t.service.updateTemplate(3, 2, { templateName: '新版', id: 88, corpId: 99, createUserId: 99 } as any);
    expect(t.templates.save.mock.calls[0][0]).toMatchObject({ id: 3, corpId: 2, createUserId: 7, templateName: '新版' });
  });
  it('rejects cross-company template updates and deletion before mutating steps', async () => {
    const t = setup();
    await expect(t.service.updateTemplate(3, 99, { templateName: '非法' })).rejects.toThrow();
    await expect(t.service.deleteTemplate(3, 99)).rejects.toThrow();
    expect(t.templates.save).not.toHaveBeenCalled();
    expect(t.steps.delete).not.toHaveBeenCalled();
  });
  it('allows owner step reads with active filter and defined order', async () => {
    const t = setup();
    await (t.service.getSteps as any)(3, 2);
    expect(t.templates.findOne).toHaveBeenCalledWith({ where: { id: 3, corpId: 2 } });
    expect(t.steps.find).toHaveBeenCalledWith({ where: { templateId: 3, status: 1 }, order: { stepOrder: 'ASC' } });
  });
  it('fails closed if an internal caller omits company context', async () => {
    const t = setup();
    await expect((t.service.getSteps as any)(3)).rejects.toThrow('模板不存在');
    await expect((t.service.batchCreateSteps as any)(dto())).rejects.toThrow('模板不存在');
    expect(t.steps.find).not.toHaveBeenCalled();
    expect(t.steps.delete).not.toHaveBeenCalled();
  });

});
