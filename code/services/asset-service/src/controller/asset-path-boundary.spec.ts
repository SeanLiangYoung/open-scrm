import { describe, it, expect, vi } from 'vitest';
vi.mock('../entity/asset.entity', () => ({ AssetEntity: class AssetEntity {} }));
vi.mock('../entity/asset-category.entity', () => ({
  AssetCategoryEntity: class AssetCategoryEntity {}
}));
vi.mock('../entity/asset-usage.entity', () => ({ AssetUsageEntity: class AssetUsageEntity {} }));
import { getClassMetadata, INJECT_CUSTOM_PARAM } from '@midwayjs/core';
import { AssetController } from './asset.controller';
import { AssetCategoryController } from './asset-category.controller';
const ctx = { state: { user: { corpId: 1, userId: 2 } }, get: () => '' };
const invalid = ['0', '-1', '01', '1e0', '0x1', '1.5', '1tail', ' 1', '+1', '9007199254740992'];
const routes = [
  [AssetController, 'getAsset', 'getAssetById', Number.MAX_SAFE_INTEGER],
  [AssetController, 'updateAsset', 'updateAsset', Number.MAX_SAFE_INTEGER],
  [AssetController, 'deleteAsset', 'deleteAsset', Number.MAX_SAFE_INTEGER],
  [AssetCategoryController, 'updateCategory', 'updateCategory', 2147483647],
  [AssetCategoryController, 'deleteCategory', 'deleteCategory', 2147483647]
] as const;
describe('asset paths use canonical exact IDs', () => {
  for (const [Class, method, serviceMethod, max] of routes) {
    it(`${method} binds id from URL path rather than query`, () => {
      const params = getClassMetadata(INJECT_CUSTOM_PARAM, Class)[method];
      const id = params.find((p: any) => p.parameterIndex === 0);
      expect(id.metadata).toMatchObject({ type: 'param', propertyData: 'id' });
    });
    function fixture() {
      const invoke = vi.fn().mockResolvedValue({ id: 1 });
      const controller = Object.assign(new Class(), {
        ctx,
        assetService: { [serviceMethod]: invoke },
        assetCategoryService: { [serviceMethod]: invoke }
      });
      return {
        invoke,
        call: (id: string) =>
          (controller[method as keyof typeof controller] as Function).call(controller, id, {})
      };
    }
    it.each(invalid)(`${method} rejects %s before service`, async id => {
      const f = fixture();
      await expect(f.call(id)).rejects.toMatchObject({ status: 400 });
      expect(f.invoke).not.toHaveBeenCalled();
    });
    it(`${method} preserves its legitimate maximum`, async () => {
      const f = fixture();
      await f.call(String(max));
      expect(f.invoke.mock.calls[0].slice(0, 2)).toEqual([1, max]);
    });
    if (max === 2147483647)
      it(`${method} rejects int32 overflow`, async () => {
        const f = fixture();
        await expect(f.call('2147483648')).rejects.toMatchObject({ status: 400 });
        expect(f.invoke).not.toHaveBeenCalled();
      });
  }
});

describe('multipart category identity is checked before upload', () => {
  it.each(['1e0', '1tail', '01', '-1', '0', '2147483648'])('rejects %s', async categoryId => {
    const uploadAsset = vi.fn();
    const controller = Object.assign(new AssetController(), { ctx, assetService: { uploadAsset } });
    await expect(
      controller.uploadAsset([{ filename: 'x.png' }], { type: '1', categoryId })
    ).rejects.toMatchObject({ status: 400 });
    expect(uploadAsset).not.toHaveBeenCalled();
  });
});
