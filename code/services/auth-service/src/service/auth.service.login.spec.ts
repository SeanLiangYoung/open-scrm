import { describe, expect, it, vi } from 'vitest';
vi.mock('../entity/user.entity', () => ({ UserEntity: class UserEntity {} }));
import { AuthService } from './auth.service';
const account = (corpId: number, password = 'good', status = 1) => ({
  id: corpId + 10,
  corpId: String(corpId),
  username: 'same',
  password,
  status,
  isAdmin: 0,
  roles: [{ roleCode: 'operator' }]
});
function setup(rows = [account(1)]) {
  const repo = {
    find: vi.fn(async ({ where, take }: any) =>
      rows.filter(row => row.username === where.username).slice(0, take)
    ),
    findOne: vi.fn(
      async ({ where }: any) =>
        rows.find(
          row =>
            row.username === where.username &&
            (where.corpId === undefined || String(row.corpId) === String(where.corpId))
        ) || null
    ),
    update: vi.fn()
  };
  const sign = vi.fn(async () => 'signed-token');
  const verifyPassword = vi.fn(async (password: string, hash: string) => password === hash);
  const service = Object.assign(new AuthService(), {
    userRepo: repo,
    jwtService: { sign },
    passwordUtil: { verifyPassword }
  });
  return { service, repo, sign, verifyPassword };
}
function noSideEffects(t: ReturnType<typeof setup>) {
  expect(t.sign).not.toHaveBeenCalled();
  expect(t.repo.update).not.toHaveBeenCalled();
}
describe('AuthService.login enterprise disambiguation', () => {
  it('keeps two-argument unique username login and response/token fields', async () => {
    const t = setup();
    expect(await t.service.login('same', 'good')).toMatchObject({
      accessToken: 'signed-token',
      refreshToken: 'signed-token',
      user: { id: 11, username: 'same', corpId: '1', isAdmin: 0 }
    });
    expect(t.repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: 'same' }, take: 2 })
    );
    expect(t.sign.mock.calls[0][0]).toMatchObject({ userId: 11, corpId: '1', roles: ['operator'] });
    expect(t.repo.update).toHaveBeenCalledWith(11, { lastLoginTime: expect.any(Date) });
  });
  it.each([1, 2])('selects exact enterprise %s for duplicated usernames', async corpId => {
    const t = setup([account(1, 'one'), account(2, 'two')]);
    expect((await t.service.login('same', corpId === 1 ? 'one' : 'two', corpId)).user.corpId).toBe(
      String(corpId)
    );
    expect(t.repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: 'same', corpId } })
    );
    expect(t.repo.find).not.toHaveBeenCalled();
  });
  it('rejects ambiguity before password checks or signing without exposing candidates', async () => {
    const t = setup([account(1), account(2)]);
    await expect(t.service.login('same', 'good')).rejects.toMatchObject({
      status: 400,
      message: '同名账号存在多个企业，请填写企业编号'
    });
    expect(t.verifyPassword).not.toHaveBeenCalled();
    noSideEffects(t);
  });
  it.each([
    { name: 'unknown account', rows: [], corpId: undefined, password: 'good' },
    { name: 'wrong enterprise', rows: [account(1)], corpId: 2, password: 'good' },
    { name: 'wrong password', rows: [account(1)], corpId: 1, password: 'bad' },
    { name: 'disabled account', rows: [account(1, 'good', 0)], corpId: 1, password: 'good' },
    {
      name: 'another enterprise password',
      rows: [account(1, 'one'), account(2, 'two')],
      corpId: 1,
      password: 'two'
    }
  ])('uses the same401 for $name without signing/updating', async ({ rows, corpId, password }) => {
    const t = setup(rows);
    await expect(t.service.login('same', password, corpId)).rejects.toMatchObject({
      status: 401,
      message: '账号或密码错误'
    });
    noSideEffects(t);
  });
  it.each(
    [0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, '1', null, [], {}, NaN, Infinity].map(corpId => ({
      corpId
    }))
  )('rejects invalid explicit enterprise $corpId before database access', async ({ corpId }) => {
    const t = setup();
    await expect(t.service.login('same', 'good', corpId as number)).rejects.toMatchObject({
      status: 400
    });
    expect(t.repo.find).not.toHaveBeenCalled();
    expect(t.repo.findOne).not.toHaveBeenCalled();
    noSideEffects(t);
  });
  it.each([
    { username: '', password: 'good' },
    { username: ' ', password: 'good' },
    { username: 'same', password: '' },
    { username: 1, password: 'good' },
    { username: 'same', password: null }
  ])('rejects invalid credentials shape before effects', async ({ username, password }) => {
    const t = setup();
    await expect(t.service.login(username as string, password as string)).rejects.toMatchObject({
      status: 400
    });
    noSideEffects(t);
  });
});

describe('AuthService.refreshToken credential boundary', () => {
  function refreshSetup(
    payload: unknown = { userId: '12', type: 'refresh' },
    row: unknown = account(2)
  ) {
    const t = setup();
    const verify = vi.fn().mockResolvedValue(payload);
    Object.assign(t.service.jwtService, { verify });
    t.repo.findOne.mockResolvedValue(row as any);
    return { ...t, verify };
  }
  it('refreshes the active current user with the correct enterprise without access credentials', async () => {
    const t = refreshSetup();
    expect(await t.service.refreshToken('valid-refresh')).toEqual({ accessToken: 'signed-token' });
    expect(t.verify).toHaveBeenCalledWith('valid-refresh');
    expect(t.repo.findOne).toHaveBeenCalledWith({ where: { id: '12' }, relations: ['roles'] });
    expect(t.sign).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 12, corpId: '2', roles: ['operator'] })
    );
    expect(t.repo.update).not.toHaveBeenCalled();
  });
  it.each(['invalid', 'expired'])('rejects %s refresh credentials with401', async reason => {
    const t = refreshSetup();
    t.verify.mockRejectedValueOnce(new Error(reason));
    await expect(t.service.refreshToken(reason)).rejects.toMatchObject({
      status: 401,
      message: '刷新凭证无效或已过期'
    });
    expect(t.repo.findOne).not.toHaveBeenCalled();
    noSideEffects(t);
  });
  it('does not accept an access token as a refresh token', async () => {
    const t = refreshSetup({ userId: 12, corpId: '2', roles: [] });
    await expect(t.service.refreshToken('access-token')).rejects.toMatchObject({ status: 401 });
    expect(t.repo.findOne).not.toHaveBeenCalled();
    noSideEffects(t);
  });
  it.each([
    { userId: undefined, type: 'refresh' },
    { userId: '0', type: 'refresh' },
    { userId: '01', type: 'refresh' },
    { userId: Number.MAX_SAFE_INTEGER + 1, type: 'refresh' }
  ])('rejects malformed signed refresh identity before user lookup', async payload => {
    const t = refreshSetup(payload);
    await expect(t.service.refreshToken('malformed-refresh')).rejects.toMatchObject({
      status: 401
    });
    expect(t.repo.findOne).not.toHaveBeenCalled();
    noSideEffects(t);
  });
  it.each([
    { name: 'disabled', row: account(2, 'good', 0) },
    { name: 'missing', row: null }
  ])('rejects $name current user with401', async ({ row }) => {
    const t = refreshSetup({ userId: 12, type: 'refresh' }, row);
    await expect(t.service.refreshToken('refresh-token')).rejects.toMatchObject({ status: 401 });
    noSideEffects(t);
  });
});
