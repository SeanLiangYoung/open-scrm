import { expect, it, vi, describe } from 'vitest';
vi.mock('../entity/user.entity', () => ({ UserEntity: class UserEntity {} }));
vi.mock('../entity/role.entity', () => ({ RoleEntity: class RoleEntity {} }));
import { getSchema } from '@midwayjs/validate';
import { UserController, ResetPasswordDto, AssignRolesDto } from './user.controller';
function fixture() {
  const methods = {
    getUserById: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    resetPassword: vi.fn(),
    assignRoles: vi.fn()
  };
  return { controller: Object.assign(new UserController(), { userService: methods }), methods };
}
const routes = [
  { method: 'getUserById', invoke: (c: any, id: string) => c.getUser(id) },
  { method: 'updateUser', invoke: (c: any, id: string) => c.updateUser(id, { realName: 'valid' }) },
  { method: 'deleteUser', invoke: (c: any, id: string) => c.deleteUser(id) },
  {
    method: 'resetPassword',
    invoke: (c: any, id: string) => c.resetPassword(id, { newPassword: 'Admin@123' })
  },
  { method: 'assignRoles', invoke: (c: any, id: string) => c.assignRoles(id, { roleIds: [3] }) }
] as const;
describe('global admin user paths are canonical BIGINT-safe strings', () => {
  for (const route of routes) {
    it.each(['2e0', '0x2', '02', '+2', '2.5', ' 2', '9007199254740993', '0', '-1'])(
      `${route.method} rejects %s before service`,
      async id => {
        const t = fixture();
        await expect(route.invoke(t.controller, id)).rejects.toMatchObject({ status: 400 });
        for (const call of Object.values(t.methods)) expect(call).not.toHaveBeenCalled();
      }
    );
    it.each(['2', String(Number.MAX_SAFE_INTEGER)])(
      `${route.method} preserves valid global-user ID %s`,
      async id => {
        const t = fixture();
        await route.invoke(t.controller, id);
        expect(t.methods[route.method].mock.calls[0][0]).toBe(Number(id));
      }
    );
  }
});
it.each(['', 'x', '1234567', null, 7])('reset schema rejects invalid password %s', newPassword =>
  expect(getSchema(ResetPasswordDto).validate({ newPassword }).error).toBeDefined()
);
it('reset schema accepts min8 only field and rejects identity injection', () => {
  expect(getSchema(ResetPasswordDto).validate({ newPassword: '12345678' }).error).toBeUndefined();
  expect(
    getSchema(ResetPasswordDto).validate({ newPassword: '12345678', userId: 99 }).error
  ).toBeDefined();
});
it.each([undefined, '3', [true], ['3'], [0], [-1], [1.5], [2147483648]])(
  'role schema rejects missing/malformed/int4-overflow %s',
  roleIds => expect(getSchema(AssignRolesDto).validate({ roleIds }).error).toBeDefined()
);
it('role DTO preserves deliberate empty-clear and numeric INT32 boundaries', () => {
  for (const roleIds of [[], [1, 2147483647]])
    expect(getSchema(AssignRolesDto).validate({ roleIds }).error).toBeUndefined();
});
