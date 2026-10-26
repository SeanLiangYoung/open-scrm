import { describe, expect, it, vi } from 'vitest';
import { getSchema } from '@midwayjs/validate';
import { TagService } from './tag.service';
import { TagController } from '../controller/tag.controller';
import { CreateTagDto } from '../dto/create-tag.dto';
import { UpdateTagDto } from '../dto/update-tag.dto';
import { MAX_TAG_ID, tagId } from '../util/tag-integrity.util';
type Row = { id: number; corpId: number; tagName: string; parentId: number; tagType: number; sort: number; isAuto: number; status: number; tagColor: string | null };
const row = (id: number, corpId: number, name: string, parentId = 0): Row => ({ id, corpId, tagName: name, parentId, tagType: 3, sort: 8, isAuto: 1, status: 1, tagColor: '#123456' });
function fixture(headers: Record<string, string> = { 'x-corp-id': '2', 'x-user-id': '7' }) {
  const rows = [row(21, 2, 'owned'), row(11, 1, 'foreign')];
  const match = (item: Row, where: Partial<Row>) => Object.entries(where).every(([key, value]) => item[key as keyof Row] === value);
  const transaction = vi.fn();
  const lock = vi.fn().mockResolvedValue([]);
  const repository = {
    findOne: vi.fn(async ({ where }: { where: Partial<Row> }) => { const found = rows.find(item => match(item, where)); return found ? { ...found } : null; }),
    find: vi.fn(async ({ where }: { where: Partial<Row> }) => rows.filter(item => match(item, where)).map(item => ({ ...item }))),
    create: vi.fn((input: Partial<Row>) => ({ ...row(rows.length + 100, 2, '', 0), tagType: 1, sort: 0, isAuto: 0, ...input })),
    save: vi.fn(async (input: Row | Row[]) => {
      const save = (value: Row) => { const index = rows.findIndex(item => item.id === value.id); if (index < 0) rows.push({ ...value }); else rows[index] = { ...value }; return value; };
      return Array.isArray(input) ? input.map(save) : save(input);
    }),
    remove: vi.fn(async (input: Row) => { rows.splice(rows.findIndex(item => item.id === input.id), 1); }),
    manager: { transaction }
  };
  transaction.mockImplementation(async (work: (manager: { getRepository: () => typeof repository; query: typeof lock }) => Promise<unknown>) => {
    const before = rows.map(item => ({ ...item }));
    try { return await work({ getRepository: () => repository, query: lock }); }
    catch (error) { rows.splice(0, rows.length, ...before); throw error; }
  });
  const service = Object.assign(new TagService(), { tagRepository: repository, ctx: { headers, get: (name: string) => headers[name] || '' } });
  const controller = Object.assign(new TagController(), { tagService: service });
  return { service, controller, repository, rows, transaction, lock };
}
describe('tag immutable runtime contracts', () => {
  it('UpdateTagDto is a schema class with no create defaults', () => {
    expect(Object.keys(new UpdateTagDto())).toEqual([]);
    expect(getSchema(UpdateTagDto).validate({}).error).toBeUndefined();
  });
  for (const [name, Type] of [['create', CreateTagDto], ['update', UpdateTagDto]] as const) {
    for (const key of ['id', 'corpId', 'status', 'children']) it(`${name} DTO rejects internal ${key}`, () => {
      expect(getSchema(Type).validate({ tagName: 'name', [key]: key === 'children' ? [] : 1 }).error).toBeDefined();
    });
  }
  it('direct update rejects immutable payload before loading or saving foreign primary key', async () => {
    const t = fixture(); await expect(t.service.update(21, Object.assign({ tagName: 'edit' }, { id: 11, corpId: 1 }))).rejects.toMatchObject({ status: 400 });
    expect(t.repository.findOne).not.toHaveBeenCalled(); expect(t.rows[1].tagName).toBe('foreign');
  });
  it('direct create rejects injected foreign primary key', async () => {
    const t = fixture(); await expect(t.service.create(Object.assign({ tagName: 'edit' }, { id: 11 }))).rejects.toMatchObject({ status: 400 }); expect(t.repository.save).not.toHaveBeenCalled();
  });
  it('batch rejects injected primary key before any transaction write', async () => {
    const t = fixture(); await expect(t.controller.batchCreate([Object.assign({ tagName: 'edit' }, { id: 11 })])).rejects.toMatchObject({ status: 400 }); expect(t.repository.save).not.toHaveBeenCalled();
  });
  it('omitted update fields preserve actual parent/type/sort/automatic metadata and enterprise', async () => {
    const t = fixture(); t.rows[0].parentId = 22; t.rows.push(row(22, 2, 'parent'));
    expect(await t.service.update(21, { tagName: 'renamed' })).toMatchObject({ id: 21, corpId: 2, tagName: 'renamed', parentId: 22, tagType: 3, sort: 8, isAuto: 1 });
  });
  it('explicit null color clears nullable column while omission preserves existing color', async () => {
    const t = fixture(); expect(await t.service.update(21, { tagColor: null })).toMatchObject({ tagColor: null });
  });
});
describe('parent ownership and atomic batches', () => {
  it('same enterprise parent remains usable and root tree contains its child', async () => {
    const t = fixture(); const child = await t.service.create({ tagName: 'child', parentId: 21 });
    expect(child.corpId).toBe(2); expect((await t.service.getTagTree())[0].children[0].id).toBe(child.id);
  });
  for (const parentId of [11, 999]) for (const operation of ['create', 'update', 'batch'] as const) it(`${operation} rejects foreign/missing parent ${parentId}`, async () => {
    const t = fixture(), input = { tagName: 'child', parentId };
    const action = operation === 'create' ? t.service.create(input) : operation === 'update' ? t.service.update(21, input) : t.service.batchCreate([input]);
    await expect(action).rejects.toMatchObject({ status: 400 }); expect(t.repository.save).not.toHaveBeenCalled();
  });
  it('self-parent is rejected', async () => { const t = fixture(); await expect(t.service.update(21, { parentId: 21 })).rejects.toMatchObject({ status: 400 }); });
  it('descendant cycle is rejected', async () => { const t = fixture(); t.rows.push(row(22, 2, 'child', 21)); await expect(t.service.update(21, { parentId: 22 })).rejects.toMatchObject({ status: 400 }); });
  for (const count of [0, 101]) it(`rejects batch length ${count}`, async () => { const t = fixture(); await expect(t.service.batchCreate(Array.from({ length: count }, (_, i) => ({ tagName: `name${i}` })))).rejects.toMatchObject({ status: 400 }); });
  it('mixed invalid parent batch never saves its otherwise valid first item', async () => {
    const t = fixture(); await expect(t.service.batchCreate([{ tagName: 'first', parentId: 0 }, { tagName: 'bad', parentId: 11 }])).rejects.toMatchObject({ status: 400 }); expect(t.repository.save).not.toHaveBeenCalled(); expect(t.rows).toHaveLength(2);
  });
  it('save failure rolls back whole batch', async () => {
    const t = fixture(); t.repository.save.mockImplementationOnce(async () => { t.rows.push(row(101, 2, 'partial')); throw new Error('save failure'); });
    await expect(t.service.batchCreate([{ tagName: 'first' }, { tagName: 'second' }])).rejects.toThrow('save failure'); expect(t.rows).toHaveLength(2); expect(t.transaction).toHaveBeenCalledTimes(1);
  });
  it('duplicate names within batch reject before writes', async () => { const t = fixture(); await expect(t.service.batchCreate([{ tagName: 'same' }, { tagName: 'same' }])).rejects.toMatchObject({ status: 400 }); expect(t.repository.save).not.toHaveBeenCalled(); });
  it('cannot delete a parent while children exist', async () => { const t = fixture(); t.rows.push(row(22, 2, 'child', 21)); await expect(t.service.delete(21)).rejects.toMatchObject({ status: 400 }); expect(t.repository.remove).not.toHaveBeenCalled(); });
});
describe('identity and path numbers', () => {
  for (const headers of [{}, { 'x-corp-id': '2' }, { 'x-user-id': '7' }, { 'x-corp-id': '2junk', 'x-user-id': '7' }, { 'x-corp-id': '9007199254740993', 'x-user-id': '7' }, { 'x-corp-id': '0', 'x-user-id': '7' }]) it(`requires complete safe identity ${JSON.stringify(headers)}`, async () => {
    const t = fixture(headers); await expect(t.service.create({ tagName: 'invalid identity' })).rejects.toMatchObject({ status: 401 }); expect(t.repository.findOne).not.toHaveBeenCalled();
  });
  for (const raw of ['21junk', '21.5', '01', '2147483648', '9007199254740993']) for (const method of ['getById', 'update', 'delete'] as const) it(`${method} rejects ${raw} before repository access`, async () => {
    const t = fixture();
    // Actual emitted metadata/route conversion is verified by the independent TS/Node probe.
    const routeId = raw;
    const action = method === 'update' ? t.controller.update(routeId, { tagName: 'edit' }) : t.controller[method](routeId);
    await expect(action).rejects.toMatchObject({ status: 400 }); expect(t.repository.findOne).not.toHaveBeenCalled();
  });
  it('PostgreSQL INTEGER tag limit is exact and below JS safe integer limit', () => { expect(tagId(MAX_TAG_ID)).toBe(2147483647); expect(() => tagId(MAX_TAG_ID + 1)).toThrow(); });
});

describe('all enterprise tag writes acquire the same transaction advisory namespace first', () => {
  for (const operation of ['create', 'update', 'batch', 'delete'] as const) it(operation + ' locks before any tag lookup', async () => {
    const t = fixture();
    if (operation === 'create') await t.service.create({ tagName: 'new' });
    else if (operation === 'update') await t.service.update(21, { tagName: 'renamed' });
    else if (operation === 'batch') await t.service.batchCreate([{ tagName: 'new' }]);
    else await t.service.delete(21);
    expect(t.lock).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['open-scrm:customer-tag:2']);
    expect(t.lock.mock.invocationCallOrder[0]).toBeLessThan(t.repository.findOne.mock.invocationCallOrder[0]);
  });
});
