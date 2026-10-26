import { describe, expect, it, vi } from 'vitest';
import { getSchema } from '@midwayjs/validate';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { CustomerService } from './customer.service';

function setup() {
  const service = new CustomerService();
  const users = [
    { id: 7, corpId: 2, status: 1 },
    { id: 8, corpId: 2, status: 0 },
    { id: 9, corpId: 99, status: 1 }
  ];
  const current = { id: 10, corpId: 2, externalUserid: 'existing', followUserId: 6, name: '旧姓名', mobile: '13800138000', remark: '原备注' };
  const query = vi.fn(async (_sql: string, [id, corpId]: number[]) =>
    users.filter(user => user.id === id && user.corpId === corpId && user.status === 1).map(({ id }) => ({ id }))
  );
  const save = vi.fn(async (row: object) => row);
  Object.assign(service, {
    ctx: { get: (header: string) => ({ 'x-corp-id': '2', 'x-user-id': '7' })[header] || '' },
    customerRepository: {
      findOne: vi.fn(async ({ where }: { where: { id?: number; corpId: number } }) =>
        where.id === 10 && where.corpId === 2 ? { ...current } : null
      ),
      create: vi.fn((row: object) => row), save, query
    }
  });
  return { service, save, query, current };
}

describe('customer employee assignment boundary', () => {
  it('creates a customer assigned to an enabled employee in its own enterprise', async () => {
    const t = setup();
    const saved = await t.service.create({ externalUserid: 'new', followUserId: 7 });
    expect(saved).toMatchObject({ corpId: 2, followUserId: 7 });
    expect(t.query).toHaveBeenCalledWith(expect.stringContaining('"user"'), [7, 2]);
    expect(t.save).toHaveBeenCalledTimes(1);
  });

  it('updates an owned customer to an enabled employee in the same enterprise', async () => {
    const t = setup();
    expect(await t.service.update(10, { followUserId: 7 })).toMatchObject({ corpId: 2, followUserId: 7 });
    expect(t.query).toHaveBeenCalledWith(expect.stringContaining('"user"'), [7, 2]);
    expect(t.save).toHaveBeenCalledTimes(1);
  });

  for (const [kind, id] of [['disabled', 8], ['foreign', 9], ['missing', 999]] as const) {
    it(`rejects ${kind} employee on create without saving a customer`, async () => {
      const t = setup();
      await expect(t.service.create({ externalUserid: 'new', followUserId: id })).rejects.toMatchObject({ status: 400 });
      expect(t.save).not.toHaveBeenCalled();
    });
    it(`rejects ${kind} employee on update without changing the existing assignment`, async () => {
      const t = setup();
      await expect(t.service.update(10, { followUserId: id })).rejects.toMatchObject({ status: 400 });
      expect(t.save).not.toHaveBeenCalled();
      expect(t.current.followUserId).toBe(6);
    });
  }

  for (const id of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    it(`rejects malformed employee ID ${id} on create before any lookup or save`, async () => {
      const t = setup();
      await expect(t.service.create({ externalUserid: 'bad-id', followUserId: id })).rejects.toMatchObject({ status: 400 });
      expect(t.query).not.toHaveBeenCalled();
      expect(t.save).not.toHaveBeenCalled();
    });
    it(`rejects malformed employee ID ${id} on update before any lookup or save`, async () => {
      const t = setup();
      await expect(t.service.update(10, { followUserId: id })).rejects.toMatchObject({ status: 400 });
      expect(t.query).not.toHaveBeenCalled();
      expect(t.save).not.toHaveBeenCalled();
    });
  }

  it('creates without requiring an optional employee assignment', async () => {
    const t = setup();
    const saved = await t.service.create({ externalUserid: 'unassigned' });
    expect(saved).not.toHaveProperty('followUserId');
    expect(t.query).not.toHaveBeenCalled();
  });

  it('persists explicit null clears without changing the omitted employee assignment', async () => {
    const t = setup();
    expect(await t.service.update(10, { mobile: null, remark: null })).toMatchObject({ mobile: null, remark: null, followUserId: 6 });
    expect(t.query).not.toHaveBeenCalled();
  });

  it('preserves the existing owner when updating unrelated fields', async () => {
    const t = setup();
    expect(await t.service.update(10, { name: '新姓名' })).toMatchObject({ followUserId: 6, name: '新姓名' });
    expect(t.query).not.toHaveBeenCalled();
  });
});

describe('explicit assignment removal', () => {
  it('allows null only on update DTO', () => {
    expect(getSchema(UpdateCustomerDto).validate({ followUserId: null }).error).toBeUndefined();
    expect(getSchema(CreateCustomerDto).validate({ externalUserid: 'new', followUserId: null }).error).toBeDefined();
  });
  it('clears an owned customer without employee lookup', async () => {
    const t = setup();
    expect(await t.service.update(10, { followUserId: null })).toMatchObject({ followUserId: null });
    expect(t.query).not.toHaveBeenCalled();
    expect(t.save).toHaveBeenCalledTimes(1);
  });
  it('does not clear a foreign or missing customer', async () => {
    const t = setup();
    await expect(t.service.update(999, { followUserId: null })).rejects.toThrow('客户不存在');
    expect(t.query).not.toHaveBeenCalled();
    expect(t.save).not.toHaveBeenCalled();
  });
});

describe('raw assignment input rejects type confusion', () => {
  for (const value of ['7', '', true]) {
    it(`rejects raw ${JSON.stringify(value)} on create and update`, async () => {
      const t = setup();
      const dto = Object.assign({ followUserId: 7 }, { followUserId: value });
      await expect(t.service.create({ externalUserid: 'raw', ...dto })).rejects.toMatchObject({ status: 400 });
      await expect(t.service.update(10, dto)).rejects.toMatchObject({ status: 400 });
      expect(t.query).not.toHaveBeenCalled();
      expect(t.save).not.toHaveBeenCalled();
    });
  }
});
