import { describe, expect, it, vi } from 'vitest';
import { CustomerService } from './customer.service';
import { CustomerEntity } from '../entity/customer.entity';

function setup() {
  let rows: Array<Record<string, any>> = [];
  let failSave = false;
  const tags = { find: vi.fn(async ({ where }: any) => where.id.value.filter((id: number) => id === 21).map((id: number) => ({ id, corpId: 2 }))) };
  const saveRow = async (row: Record<string, any>) => {
    const saved = { ...row, id: row.id || 1 }; rows = [saved]; return saved;
  };
  const transactional = { create: vi.fn((row: object) => row), findOne: vi.fn(async () => rows[0] || null),
    save: vi.fn(async (row: Record<string, any>) => { const saved = await saveRow(row); if (failSave) throw new Error('simulated save failure'); return saved; }) };
  const manager = { getRepository: (entity: unknown) => entity === CustomerEntity ? transactional : tags,
    transaction: async (callback: (value: unknown) => Promise<unknown>) => { const before = [...rows]; try { return await callback(manager); } catch (e) { rows = before; throw e; } } };
  const outer = { findOne: vi.fn(async () => null), create: vi.fn((row: object) => row), save: vi.fn(saveRow), manager };
  const service = Object.assign(new CustomerService(), { customerRepository: outer, tagRepository: tags,
    ctx: { get: (key: string) => ({ 'x-corp-id': '2', 'x-user-id': '7' })[key] || '' } });
  return { service, outer, transactional, tags, rows: () => rows, failSave: () => { failSave = true; } };
}
describe('customer creation with tags is one atomic operation', () => {
  for (const tagIds of [[21, 11], [21, 999], [11], ['21']]) {
    it(`rejects the full request without a persisted customer: ${JSON.stringify(tagIds)}`, async () => {
      const t = setup();
      await expect(t.service.create({ externalUserid: 'atomic', tagIds: tagIds as number[] })).rejects.toMatchObject({ status: 400 });
      expect(t.rows()).toHaveLength(0);
      expect(t.outer.save).not.toHaveBeenCalled();
    });
  }
  it('rolls back the customer when saving its valid tag relation fails', async () => {
    const t = setup(); t.failSave();
    await expect(t.service.create({ externalUserid: 'atomic', tagIds: [21] })).rejects.toThrow('simulated save failure');
    expect(t.rows()).toHaveLength(0);
  });
  it('creates one customer with deduplicated owned tags', async () => {
    const t = setup();
    const saved = await t.service.create({ externalUserid: 'atomic', tagIds: [21, 21] });
    expect(saved.tags).toEqual([{ id: 21, corpId: 2 }]);
    expect(t.rows()).toHaveLength(1);
    expect(t.outer.save).not.toHaveBeenCalled();
  });
  for (const tagIds of [undefined, []]) it(`keeps optional empty tags compatible: ${JSON.stringify(tagIds)}`, async () => {
    const t = setup(); await t.service.create({ externalUserid: 'no-tags', tagIds });
    expect(t.rows()).toHaveLength(1); expect(t.tags.find).not.toHaveBeenCalled();
  });
});
