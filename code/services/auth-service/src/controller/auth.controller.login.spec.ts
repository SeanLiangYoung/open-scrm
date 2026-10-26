import { describe, expect, it, vi } from 'vitest';
vi.mock('../entity/user.entity', () => ({ UserEntity: class UserEntity {} }));
import { getSchema } from '@midwayjs/validate';
import { AuthController, LoginDto, RefreshTokenDto } from './auth.controller';
describe('actual login DTO schema', () => {
  it('accepts legacy omitted enterprise and explicit safe numeric enterprise', () => {
    const schema = getSchema(LoginDto);
    expect(schema.validate({ username: 'same', password: 'good' }).error).toBeUndefined();
    expect(
      schema.validate({ username: 'same', password: 'good', corpId: 2 }).error
    ).toBeUndefined();
  });
  it.each(
    [0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, '2', null, [], {}, NaN, Infinity].map(corpId => ({
      corpId
    }))
  )('rejects invalid enterprise $corpId through the actual schema', ({ corpId }) => {
    expect(
      getSchema(LoginDto).validate({ username: 'same', password: 'good', corpId }).error
    ).toBeDefined();
  });
  it('forwards optional enterprise without changing the returned response', async () => {
    const controller = new AuthController();
    const response = {
      accessToken: 'access',
      refreshToken: 'refresh',
      user: { id: 1, corpId: '2' }
    };
    const login = vi.fn().mockResolvedValue(response);
    controller.authService = { login } as any;
    expect(await controller.login({ username: 'same', password: 'good', corpId: 2 })).toBe(
      response
    );
    expect(login).toHaveBeenCalledWith('same', 'good', 2);
  });
});

describe('actual refresh DTO schema', () => {
  it('requires the refresh token body and retains its value', () => {
    expect(getSchema(RefreshTokenDto).validate({ refreshToken: 'signed-refresh' }).value).toEqual({
      refreshToken: 'signed-refresh'
    });
    for (const body of [
      {},
      { refreshToken: '' },
      { refreshToken: null },
      { refreshToken: 123 },
      { refreshToken: [] }
    ]) {
      expect(getSchema(RefreshTokenDto).validate(body).error).toBeDefined();
    }
  });
  it('forwards validated refresh body unchanged', async () => {
    const controller = new AuthController();
    const refreshToken = vi.fn().mockResolvedValue({ accessToken: 'fresh-access' });
    controller.authService = { refreshToken } as any;
    expect(await controller.refreshToken({ refreshToken: 'signed-refresh' })).toEqual({
      accessToken: 'fresh-access'
    });
    expect(refreshToken).toHaveBeenCalledWith('signed-refresh');
  });
});
