import { describe, expect, it, vi } from 'vitest';
import { CustomerService } from './customer.service';
import { CustomerController } from '../controller/customer.controller';
import { CustomerEntity } from '../entity/customer.entity';
function fixture() {
  let current = { id: 201, corpId: 2, tags: [{ id: 21, corpId: 2, tagName: 'existing' }] };
  const save = vi.fn(async (value: typeof current) => { current = value; return value; });
  const customers = { findOne: vi.fn(async ({ where }: { where: { id: number; corpId: number } }) => where.id === 201 && where.corpId === 2 ? { ...current, tags: [...current.tags] } : null), save };
  const tags = { find: vi.fn(async ({ where }: { where: { id: { value: number[] }; corpId: number } }) => [21, 22].filter(id => where.corpId === 2 && where.id.value.includes(id)).map(id => ({ id, corpId: 2, tagName: `tag${id}` }))) };
  const transaction = vi.fn(async (work: (manager: { getRepository: (entity: unknown) => typeof customers | typeof tags }) => Promise<void>) => work({ getRepository: entity => entity === CustomerEntity ? customers : tags }));
  const service = Object.assign(new CustomerService(), { ctx: { get: (name: string) => ({ 'x-corp-id': '2', 'x-user-id': '7' }[name] || '') }, customerRepository: { ...customers, manager: { transaction } } });
  return { service, controller: Object.assign(new CustomerController(), { customerService: service }), customers, tags, save, getCurrent: () => current };
}
describe('customer tag requests validate the entire own-enterprise set', () => {
  for (const ids of [[21, 11], [21, 999]]) it(`mixed invalid tags ${ids} never save a partial set`, async () => {
    const t = fixture(); await expect(t.service.addTags(201, ids)).rejects.toMatchObject({ status: 400 }); expect(t.save).not.toHaveBeenCalled(); expect(t.getCurrent().tags.map(tag => tag.id)).toEqual([21]);
  });
  it('existing valid tags are idempotent and new valid tags merge once', async () => {
    const t = fixture(); await t.service.addTags(201, [21, 22, 22]); await t.service.addTags(201, [21, 22]); expect(t.getCurrent().tags.map(tag => tag.id)).toEqual([21, 22]);
  });
  it('foreign/missing customer fails before tag lookup', async () => { const t = fixture(); await expect(t.service.addTags(999, [21])).rejects.toMatchObject({ status: 404 }); expect(t.tags.find).not.toHaveBeenCalled(); expect(t.save).not.toHaveBeenCalled(); });
  for (const body of [{ tagIds: [] }, { tagIds: ['21'] }, { tagIds: [0] }, { tagIds: [2147483648] }, { tagIds: [21], corpId: 1 }, null]) it(`controller rejects malformed full body ${JSON.stringify(body)}`, async () => {
    const t = fixture(); await expect(t.controller.addTags('201', body)).rejects.toMatchObject({ status: 400 }); expect(t.customers.findOne).not.toHaveBeenCalled();
  });
  for (const id of ['201junk', '201.5', '01', '9007199254740993']) it(`customer-tag path rejects ${id} before lookup`, async () => { const t = fixture(); await expect(t.controller.addTags(id, { tagIds: [21] })).rejects.toMatchObject({ status: 400 }); expect(t.customers.findOne).not.toHaveBeenCalled(); });
  it('remove path rejects out-of-range tag identifier', async () => { const t = fixture(); await expect(t.controller.removeTag('201', '2147483648')).rejects.toMatchObject({ status: 400 }); expect(t.customers.findOne).not.toHaveBeenCalled(); });
});
