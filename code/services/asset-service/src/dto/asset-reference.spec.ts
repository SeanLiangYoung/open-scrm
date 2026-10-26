import { it, expect } from 'vitest';
import { getSchema } from '@midwayjs/validate';
import { CreateAssetDto, UpdateAssetDto, RecordAssetUsageDto, QueryAssetDto } from './asset.dto';
import { CreateCategoryDto } from './asset-category.dto';
for (const value of [0, -1, 1.5, 2147483648, '1', null]) {
  it(`rejects invalid JSON category ${JSON.stringify(value)}`, () => {
    expect(
      getSchema(CreateAssetDto).validate({ name: 'x', type: 1, categoryId: value }).error
    ).toBeDefined();
    expect(getSchema(UpdateAssetDto).validate({ categoryId: value }).error).toBeDefined();
  });
}
for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1', null]) {
  it(`rejects invalid JSON usage asset ${JSON.stringify(value)}`, () => {
    expect(
      getSchema(RecordAssetUsageDto).validate({ assetId: value, useType: 'message' }).error
    ).toBeDefined();
  });
}
it('retains valid JSON references and the root parent sentinel', () => {
  expect(
    getSchema(CreateCategoryDto).validate({ name: 'root', parentId: 0 }).error
  ).toBeUndefined();
  expect(getSchema(UpdateAssetDto).validate({ categoryId: 2147483647 }).error).toBeUndefined();
  expect(
    getSchema(RecordAssetUsageDto).validate({
      assetId: Number.MAX_SAFE_INTEGER,
      useType: 'message'
    }).error
  ).toBeUndefined();
});
it('retains ordinary URL query category conversion', () => {
  const result = getSchema(QueryAssetDto).validate({ categoryId: '31' });
  expect(result.error).toBeUndefined();
  expect(result.value.categoryId).toBe(31);
});
