import { describe, expect, it, vi } from 'vitest';
// These tests exercise query/response contracts; actual entity metadata is covered
// by the isolated PostgreSQL+HTTP harness compiled with decorator metadata.
vi.mock('../entity/user.entity', () => ({ UserEntity: class UserEntity {} }));
import { StaffController } from './staff.controller';

function setup(rows: unknown[] = [], total = rows.length) {
  const controller = new StaffController();
  const findAndCount = vi.fn().mockResolvedValue([rows, total]);
  Object.assign(controller, {
    ctx: { get: (name: string) => ({ 'x-corp-id': '2', 'x-user-id': '7' })[name] || '', state: {} },
    staffRepository: { findAndCount }
  });
  return { controller, findAndCount };
}

describe('tenant employee directory', () => {
  it('returns an explicitly public shape and preserves exact PostgreSQL bigint IDs', async () => {
    const t = setup(
      [
        {
          id: '9007199254740993',
          username: 'amy',
          realName: '艾米',
          password: 'never expose',
          mobile: 'private',
          email: 'private',
          roles: [],
          corpId: 2,
          status: 1
        }
      ],
      27
    );
    expect(await t.controller.list({})).toEqual({
      success: true,
      data: {
        list: [{ id: '9007199254740993', username: 'amy', realName: '艾米' }],
        total: 27,
        page: 1,
        pageSize: 20
      }
    });
    expect(t.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { corpId: 2, status: 1 },
        select: { id: true, username: true, realName: true },
        skip: 0,
        take: 20,
        order: { username: 'ASC', id: 'ASC' }
      })
    );
  });
  it('keeps the enterprise and enabled filter in every search alternative', async () => {
    const t = setup();
    await t.controller.list({ keyword: '  A%_  ', page: '2', pageSize: '10' });
    const options = t.findAndCount.mock.calls[0][0];
    expect(options.skip).toBe(10);
    expect(options.take).toBe(10);
    expect(options.where).toHaveLength(2);
    for (const clause of options.where) expect(clause).toMatchObject({ corpId: 2, status: 1 });
    expect(options.where[0].username.value).toBe('%A\\%\\_%');
    expect(options.where[1].realName.value).toBe('%A\\%\\_%');
  });
  it('supports a trusted authenticated state when gateway identity headers are absent', async () => {
    const t = setup([{ id: 12, username: 'peer', realName: null }]);
    Object.assign(t.controller, {
      ctx: { get: () => '', state: { user: { corpId: 3, userId: 8 } } }
    });
    expect((await t.controller.list({})).data.list[0]).toEqual({
      id: '12',
      username: 'peer',
      realName: null
    });
    expect(t.findAndCount.mock.calls[0][0].where).toEqual({ corpId: 3, status: 1 });
  });
  it.each([
    {},
    { corpId: '2' },
    { corpId: '2', userId: '0' },
    { corpId: '2x', userId: '7' },
    { corpId: '9007199254740993', userId: '7' }
  ])('refuses incomplete or ambiguous identity %j before querying', async identity => {
    const t = setup();
    Object.assign(t.controller, { ctx: { get: () => '', state: { user: identity } } });
    await expect(t.controller.list({})).rejects.toMatchObject({ status: 401 });
    expect(t.findAndCount).not.toHaveBeenCalled();
  });
  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1e1' },
    { page: ['1', '2'] },
    { pageSize: '101' },
    { pageSize: ' 2' },
    { pageSize: '1.1' },
    { page: String(Number.MAX_SAFE_INTEGER), pageSize: '100' },
    { keyword: ['alice'] },
    { keyword: 'x'.repeat(51) },
    { corpId: '99' },
    { status: '0' }
  ])('rejects invalid or identity-changing query %j before database access', async query => {
    const t = setup();
    await expect(t.controller.list(query)).rejects.toMatchObject({ status: 400 });
    expect(t.findAndCount).not.toHaveBeenCalled();
  });
});
