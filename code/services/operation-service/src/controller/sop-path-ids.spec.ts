import { describe, expect, it, vi } from 'vitest';
import { SopController } from './sop.controller';

function fixture() {
  const getTemplate = vi.fn().mockResolvedValue({ id: 1 });
  const updateTemplate = vi.fn().mockResolvedValue({ id: 1 });
  const deleteTemplate = vi.fn().mockResolvedValue(undefined);
  const getSteps = vi.fn().mockResolvedValue([]);
  const service = { getTemplate, updateTemplate, deleteTemplate, getSteps };
  const controller = Object.assign(new SopController(), {
    ctx: { get: (name: string) => ({ 'x-corp-id': '2', 'x-user-id': '7' }[name] || '') },
    sopTemplateService: service,
  });
  return { controller, service };
}
const paths: Array<{
  name: string;
  method: 'getTemplate' | 'updateTemplate' | 'deleteTemplate' | 'getSteps';
  invoke: (controller: SopController, id: string) => Promise<unknown>;
}> = [
  { name: 'GET template', method: 'getTemplate', invoke: (c, id) => c.getTemplate(id) },
  { name: 'PUT template', method: 'updateTemplate', invoke: (c, id) => c.updateTemplate(id, { templateName: '更新' }) },
  { name: 'DELETE template', method: 'deleteTemplate', invoke: (c, id) => c.deleteTemplate(id) },
  { name: 'GET steps', method: 'getSteps', invoke: (c, id) => c.getSteps(id) },
];
describe('SOP path IDs must be canonical positive PostgreSQL INT32 template IDs', () => {
  for (const route of paths) {
    describe(route.name, () => {
      it.each(['1junk', '1.5', '9007199254740993', '9007199254740992', '2147483648', '9007199254740991', '0', '-1', '01', '+1', ' 1', '1e2', 'abc', ''])('rejects malformed ID %j with400 before service calls', async id => {
        const t = fixture();
        await expect.soft(route.invoke(t.controller, id)).rejects.toMatchObject({ status: 400 });
        for (const method of Object.values(t.service)) expect.soft(method).not.toHaveBeenCalled();
      });
      it.each(['1', String(2_147_483_647)])('passes valid ID %s as exact number with current enterprise', async id => {
        const t = fixture();
        await route.invoke(t.controller, id);
        if (route.method === 'updateTemplate') {
          expect(t.service.updateTemplate).toHaveBeenCalledWith(Number(id), 2, { templateName: '更新' });
        } else {
          expect(t.service[route.method]).toHaveBeenCalledWith(Number(id), 2);
        }
      });
    });
  }
});
