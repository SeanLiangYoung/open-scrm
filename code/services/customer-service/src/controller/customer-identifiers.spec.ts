import { describe, expect, it, vi } from 'vitest';
import { getSchema } from '@midwayjs/validate';
import { CustomerController } from './customer.controller';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';

describe('customer identifiers remain canonical before framework coercion', () => {
  for (const method of ['getById', 'update', 'delete'] as const) {
    for (const value of ['1junk', '1.5', '1e2', '0x1', '01', ' 1', '0', '-1', '9007199254740993']) {
      it(`${method} rejects ${value} without touching a customer`, async () => {
        const calls = { findById: vi.fn(), update: vi.fn(), delete: vi.fn() };
        const controller = Object.assign(new CustomerController(), { customerService: calls });
        await expect(controller[method](value as never, {})).rejects.toMatchObject({ status: 400 });
        Object.values(calls).forEach(fn => expect(fn).not.toHaveBeenCalled());
      });
    }
    for (const value of ['1', String(Number.MAX_SAFE_INTEGER)]) it(`${method} accepts bigint-safe canonical ${value}`, async () => {
      const calls = { findById: vi.fn(), update: vi.fn(), delete: vi.fn() };
      const controller = Object.assign(new CustomerController(), { customerService: calls });
      await controller[method](value as never, {});
      const name = method === 'getById' ? 'findById' : method;
      expect(calls[name].mock.calls[0][0]).toBe(Number(value));
    });
  }
  for (const Dto of [CreateCustomerDto, UpdateCustomerDto]) {
    for (const value of ['1', '1e0', '01', ' 1', '0x1', true, [1], 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      it(`${Dto.name} rejects noncanonical JSON employee ${JSON.stringify(value)}`, () => {
        expect(getSchema(Dto).validate({ ...(Dto === CreateCustomerDto ? { externalUserid: 'new' } : {}), followUserId: value }).error).toBeDefined();
      });
    }
    it(`${Dto.name} accepts an exact bigint-safe employee number`, () => {
      expect(getSchema(Dto).validate({ ...(Dto === CreateCustomerDto ? { externalUserid: 'new' } : {}), followUserId: Number.MAX_SAFE_INTEGER }).error).toBeUndefined();
    });
  }
  for (const tagIds of [['21'], [0], [-1], [1.5], [2147483648], Array(101).fill(21)]) it(`create validates numeric tag references: ${JSON.stringify(tagIds).slice(0,40)}`, () => {
    expect(getSchema(CreateCustomerDto).validate({ externalUserid: 'new', tagIds }).error).toBeDefined();
  });
});
