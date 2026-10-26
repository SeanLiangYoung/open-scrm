import { describe, expect, it } from 'vitest';
import { getSchema } from '@midwayjs/validate';
import { UpdateCustomerDto } from '../dto/update-customer.dto';

const schema = getSchema(UpdateCustomerDto);
describe('customer update nullable fields contract', () => {
  it('accepts explicit null to clear mobile and remark', () => {
    expect(schema.validate({ mobile: null, remark: null }).error).toBeUndefined();
  });
  it('continues to reject invalid nonempty mobile values', () => {
    expect(schema.validate({ mobile: 'not-a-mobile' }).error).toBeDefined();
  });
  it('keeps omitted optional fields valid', () => {
    expect(schema.validate({ name: '新姓名' }).error).toBeUndefined();
  });
});
