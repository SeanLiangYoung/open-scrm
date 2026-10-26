import { describe, it, expect, vi } from 'vitest';
import { FollowUpController } from './follow-up.controller';

function setup(ownedCustomer = true) {
  const controller = new FollowUpController();
  const findOne = vi.fn(async ({ where }: any) =>
    ownedCustomer && where.id === 10 && where.corpId === 2 ? { id: 10, corpId: 2 } : null
  );
  const repo = {
    create: vi.fn((data: any) => data),
    save: vi.fn(async (data: any) => ({ id: 42, ...data })),
    findAndCount: vi.fn(async () => [[], 0])
  };
  Object.assign(controller, {
    ctx: { get: (header: string) => ({ 'x-corp-id': '2', 'x-user-id': '7' })[header] || '' },
    customerRepo: { findOne },
    followUpRepo: repo
  });
  return { controller, repo, findOne };
}

describe('follow-up tenant boundary', () => {
  it('uses authenticated company and operator, ignoring forged body identities', async () => {
    const { controller, repo } = setup();
    await controller.create({ customerId: 10, corpId: 999, userId: 999, content: '已确认预约' });
    expect(repo.save.mock.calls[0][0]).toMatchObject({ corpId: 2, userId: 7, customerId: 10 });
  });

  it('does not create follow-ups for another company customer', async () => {
    const { controller, repo } = setup(false);
    await expect(controller.create({ customerId: 10, content: '不能写入' })).rejects.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects requests without gateway or authenticated identity instead of defaulting to company 1', async () => {
    const { controller, repo } = setup();
    Object.assign(controller, { ctx: { get: () => '' } });
    await expect(
      controller.create({ customerId: 10, content: '不能使用开发默认身份' })
    ).rejects.toMatchObject({ status: 401 });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each(['2e1', '0x2', '2junk'])('rejects malformed company header %s', async company => {
    const { controller } = setup();
    Object.assign(controller, {
      ctx: { get: (header: string) => (header === 'x-corp-id' ? company : '7') }
    });
    await expect(
      controller.create({ customerId: 10, content: '拒绝歧义身份' })
    ).rejects.toMatchObject({ status: 401 });
  });

  it('uses authenticated string identity consistently without falling back to operator 1', async () => {
    const { controller, repo } = setup();
    Object.assign(controller, {
      ctx: { get: () => '', state: { user: { corpId: 2, userId: '7' } } }
    });
    await controller.create({ customerId: 10, content: '记录真实操作者' });
    expect(repo.save.mock.calls[0][0]).toMatchObject({ corpId: 2, userId: 7 });
  });

  it('does not list another company customer records', async () => {
    const { controller, repo } = setup(false);
    await expect(controller.listByCustomer('10')).rejects.toThrow();
    expect(repo.findAndCount).not.toHaveBeenCalled();
  });

  it('scopes a customer record list to the company and uses requested pagination', async () => {
    const { controller, repo } = setup();
    await controller.listByCustomer('10', '2', '5');
    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: 10, corpId: 2 },
        skip: 5,
        take: 5
      })
    );
  });

  it.each(['0', '-1', '1x', '1.5'])('rejects invalid customer ID %s', async id => {
    const { controller, repo } = setup();
    await expect(controller.listByCustomer(id)).rejects.toThrow();
    expect(repo.findAndCount).not.toHaveBeenCalled();
  });

  it.each([
    ['0', '20'],
    ['1', '1001'],
    ['1', 'NaN']
  ])('rejects invalid page %s / size %s', async (page, size) => {
    const { controller, repo } = setup();
    await expect(controller.listByCustomer('10', page, size)).rejects.toThrow();
    expect(repo.findAndCount).not.toHaveBeenCalled();
  });
});


describe('follow-up input boundary', () => {
  it.each([undefined, null])('defaults omitted type and accepts no next follow time %j', async nextFollowTime => {
    const { controller, repo } = setup();
    await controller.create({ customerId: 10, content: '  保留内容  ', nextFollowTime });
    expect(repo.save.mock.calls[0][0]).toMatchObject({ followType: 1, content: '  保留内容  ', nextFollowTime: null });
  });

  it('accepts valid leap date without milliseconds', async () => {
    const { controller, repo } = setup();
    await controller.create({ customerId: 10, content: '有效记录', nextFollowTime: '2028-02-29T10:00:00Z' });
    expect(repo.save.mock.calls[0][0]).toMatchObject({ nextFollowTime: new Date('2028-02-29T10:00:00Z') });
  });

  it.each([null, undefined, [], 'text'])('rejects non-object body %j before repository access', async body => {
    const { controller, repo, findOne } = setup();
    await expect(controller.create(body)).rejects.toMatchObject({ status: 400 });
    expect(findOne).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', '   ', 123, {}, []])('rejects invalid content %j', async content => {
    const { controller, repo } = setup();
    await expect(controller.create({ customerId: 10, content })).rejects.toMatchObject({ status: 400 });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each([0, 5, -1, 1.5, '2', null, {}, []])('rejects invalid follow type %j', async followType => {
    const { controller, repo } = setup();
    await expect(controller.create({ customerId: 10, content: '有效记录', followType })).rejects.toMatchObject({ status: 400 });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each(['not-a-date', '', 123, {}, [], '2026-02-30T10:00:00.000Z'])('rejects invalid next follow time %j', async nextFollowTime => {
    const { controller, repo } = setup();
    await expect(controller.create({ customerId: 10, content: '有效记录', nextFollowTime })).rejects.toMatchObject({ status: 400 });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3, 4])('preserves supported follow type %s and ISO time', async followType => {
    const { controller, repo } = setup();
    await controller.create({ customerId: 10, content: '有效记录', followType, nextFollowTime: '2026-10-26T08:00:00.000Z' });
    expect(repo.save.mock.calls[0][0]).toMatchObject({ followType, nextFollowTime: new Date('2026-10-26T08:00:00.000Z') });
  });

  it.each(['1e1', '0xa', ' 10 ', '+10', '10.0'])('rejects ambiguous integer syntax %s', async id => {
    const { controller, repo } = setup();
    await expect(controller.listByCustomer(id)).rejects.toMatchObject({ status: 400 });
    expect(repo.findAndCount).not.toHaveBeenCalled();
  });

  it('rejects pagination whose offset exceeds safe integer range', async () => {
    const { controller, repo } = setup();
    await expect(controller.listByCustomer('10', String(Number.MAX_SAFE_INTEGER), '100')).rejects.toMatchObject({ status: 400 });
    expect(repo.findAndCount).not.toHaveBeenCalled();
  });
});
