import { expect, it, vi } from 'vitest';
vi.mock('../entity/user.entity', () => ({ UserEntity: class UserEntity {} }));
vi.mock('../entity/role.entity', () => ({ RoleEntity: class RoleEntity {} }));
import { UserService } from './user.service';
import { UserEntity } from '../entity/user.entity';
function setup() {
  let row: any = {
    id: 7,
    corpId: 2,
    isAdmin: 0,
    username: 'fixture',
    password: 'old',
    roles: [{ id: 1, roleCode: 'old', corpId: 2 }]
  };
  const repo = {
    findOne: vi.fn(async () => structuredClone(row)),
    update: vi.fn(async (_id: any, patch: any) => {
      Object.assign(row, patch);
    }),
    save: vi.fn(async (value: any) => {
      row = structuredClone(value);
      return value;
    }),
    delete: vi.fn()
  };
  const roleQuery: any = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    setLock: vi.fn().mockReturnThis(),
    getMany: vi.fn(async () => [{ id: 3, roleCode: 'chosen', corpId: 99 }])
  };
  const roleRepo = {
    findByIds: vi.fn(async () => [{ id: 3, roleCode: 'chosen', corpId: 99 }]),
    createQueryBuilder: vi.fn(() => roleQuery)
  };
  const transaction = vi.fn(async (fn: any) => {
    const before = structuredClone(row);
    try {
      return await fn({
        getRepository: (entity: any) => (entity === UserEntity ? repo : roleRepo)
      });
    } catch (error) {
      row = before;
      throw error;
    }
  });
  Object.assign(repo, { manager: { transaction } });
  const hashPassword = vi.fn(async (password: string) => `hashed:${password}`);
  const service = Object.assign(new UserService(), {
    userRepo: repo,
    roleRepo,
    passwordUtil: { hashPassword }
  });
  return { service, repo, roleRepo, roleQuery, transaction, hashPassword, row: () => row };
}
it.each(['', 'x', '1234567', undefined, null, 3])(
  'direct reset rejects invalid input %s before lookup/hash/write',
  async value => {
    const t = setup();
    await expect(t.service.resetPassword(7, value as any)).rejects.toMatchObject({ status: 400 });
    expect(t.hashPassword).not.toHaveBeenCalled();
    expect(t.repo.update).not.toHaveBeenCalled();
    expect(t.repo.findOne).not.toHaveBeenCalled();
  }
);
it('legal reset uses exact supplied password and only updates hash', async () => {
  const t = setup();
  await t.service.resetPassword(7, 'Admin@123');
  expect(t.hashPassword).toHaveBeenCalledWith('Admin@123');
  expect(t.repo.update).toHaveBeenCalledWith(7, { password: 'hashed:Admin@123' });
});
it('missing one role rejects before replacing any old role', async () => {
  const t = setup();
  await expect(t.service.assignRoles(7, [3, 999])).rejects.toMatchObject({ status: 400 });
  expect(t.repo.save).not.toHaveBeenCalled();
  expect(t.row().roles.map((r: any) => r.id)).toEqual([1]);
});
it('legal global administrator may assign an existing role of another enterprise', async () => {
  const t = setup();
  await t.service.assignRoles(7, [3, 3]);
  expect(t.row().roles.map((r: any) => r.id)).toEqual([3]);
  expect(t.transaction).toHaveBeenCalledTimes(1);
  expect(t.repo.findOne).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 7 }, lock: { mode: 'pessimistic_write' } })
  );
  expect(t.roleQuery.setLock).toHaveBeenCalledWith('pessimistic_read');
  expect(t.roleQuery.where).toHaveBeenCalledWith('role.id IN (:...ids)', { ids: [3] });
});
it('explicit role clear is committed atomically', async () => {
  const t = setup();
  await t.service.assignRoles(7, []);
  expect(t.row().roles).toEqual([]);
  expect(t.transaction).toHaveBeenCalledTimes(1);
});
it.each([undefined, '3', [true], ['3'], [2147483648], [-1]])(
  'malformed role list %s cannot read or mutate user',
  async roleIds => {
    const t = setup();
    await expect(t.service.assignRoles(7, roleIds as any)).rejects.toMatchObject({ status: 400 });
    expect(t.repo.findOne).not.toHaveBeenCalled();
    expect(t.repo.save).not.toHaveBeenCalled();
  }
);
it('relation-save failure rolls back complete prior role set', async () => {
  const t = setup();
  t.repo.save.mockRejectedValueOnce(new Error('controlled relation failure'));
  await expect(t.service.assignRoles(7, [3])).rejects.toThrow('controlled relation failure');
  expect(t.row().roles.map((r: any) => r.id)).toEqual([1]);
});
