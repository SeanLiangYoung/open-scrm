import { describe, it, expect, vi } from 'vitest';
vi.mock('../entity/asset.entity', () => ({ AssetEntity: class AssetEntity {} }));
vi.mock('../entity/asset-category.entity', () => ({
  AssetCategoryEntity: class AssetCategoryEntity {}
}));
vi.mock('../entity/asset-usage.entity', () => ({ AssetUsageEntity: class AssetUsageEntity {} }));
import { AssetService } from './asset.service';
import { AssetCategoryService } from './asset-category.service';
import { AssetEntity } from '../entity/asset.entity';
import { AssetCategoryEntity } from '../entity/asset-category.entity';
import { AssetUsageEntity } from '../entity/asset-usage.entity';
function fixture() {
  const assets = {
    findOne: vi.fn().mockResolvedValue({ id: 7, corpId: 1 }),
    update: vi.fn(),
    increment: vi.fn().mockResolvedValue({ affected: 1 }),
    count: vi.fn().mockResolvedValue(0)
  };
  const categories = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn(x => x),
    save: vi.fn(x => x),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn().mockResolvedValue(0)
  };
  const usages = { create: vi.fn(x => x), save: vi.fn(x => x) };
  const manager = {
    query: vi.fn(),
    getRepository: vi.fn(entity =>
      entity === AssetEntity ? assets : entity === AssetCategoryEntity ? categories : usages
    )
  };
  const transaction = vi.fn(fn => fn(manager));
  const common = { manager: { transaction } };
  Object.assign(assets, common);
  Object.assign(categories, common);
  const service = Object.assign(new AssetService(), {
    assetRepository: assets,
    usageRepository: usages,
    categoryRepository: categories,
    ossService: { put: vi.fn(), delete: vi.fn() }
  });
  const categoryService = Object.assign(new AssetCategoryService(), {
    categoryRepository: categories
  });
  return { assets, categories, usages, manager, transaction, service, categoryService };
}
describe('asset writes enforce tenant references', () => {
  it('rejects a missing or foreign category before changing an asset', async () => {
    const f = fixture();
    await expect(f.service.updateAsset(1, 7, { categoryId: 88 })).rejects.toMatchObject({
      status: 400
    });
    expect(f.assets.update).not.toHaveBeenCalled();
    expect(f.categories.findOne.mock.calls[0][0].where).toEqual({ corpId: 1, id: 88 });
  });
  it('checks upload category before reading a file or calling OSS', async () => {
    const f = fixture();
    await expect(
      f.service.uploadAsset(1, {}, { name: 'asset', type: 1, categoryId: 88 })
    ).rejects.toMatchObject({ status: 400 });
    expect(f.service.ossService.put).not.toHaveBeenCalled();
  });
  it('allows a local category and preserves omitted editable fields', async () => {
    const f = fixture();
    f.categories.findOne.mockResolvedValue({ id: 8, corpId: 1 });
    await f.service.updateAsset(1, 7, { categoryId: 8 });
    expect(f.assets.update.mock.calls[0]).toEqual([{ id: 7, corpId: 1 }, { categoryId: 8 }]);
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid direct asset ID %s',
    async id => {
      const f = fixture();
      await expect(f.service.getAssetById(1, id)).rejects.toMatchObject({ status: 400 });
      expect(f.assets.findOne).not.toHaveBeenCalled();
    }
  );
  it('rejects a missing target before an update', async () => {
    const f = fixture();
    f.assets.findOne.mockResolvedValue(null);
    await expect(f.service.updateAsset(1, 7, { name: 'x' })).rejects.toMatchObject({ status: 404 });
    expect(f.assets.update).not.toHaveBeenCalled();
  });
});
describe('category hierarchy integrity', () => {
  it('rejects an absent or foreign parent before creation', async () => {
    const f = fixture();
    await expect(
      f.categoryService.createCategory(1, { name: 'child', parentId: 88 })
    ).rejects.toMatchObject({ status: 400 });
    expect(f.categories.save).not.toHaveBeenCalled();
  });
  it('preserves root category parentId=0', async () => {
    const f = fixture();
    await f.categoryService.createCategory(1, { name: 'root', parentId: 0 });
    expect(f.categories.save).toHaveBeenCalledWith(
      expect.objectContaining({ corpId: 1, parentId: 0 })
    );
  });
  it('rejects self-parenting', async () => {
    const f = fixture();
    f.categories.findOne.mockResolvedValue({ id: 7, parentId: 0 });
    await expect(f.categoryService.updateCategory(1, 7, { parentId: 7 })).rejects.toMatchObject({
      status: 400
    });
    expect(f.categories.update).not.toHaveBeenCalled();
  });
  it('rejects cycles through descendants', async () => {
    const f = fixture();
    f.categories.findOne.mockImplementation(({ where }) =>
      Promise.resolve(where.id === 8 ? { id: 8, parentId: 7 } : { id: 7, parentId: 0 })
    );
    await expect(f.categoryService.updateCategory(1, 7, { parentId: 8 })).rejects.toMatchObject({
      status: 400
    });
    expect(f.categories.update).not.toHaveBeenCalled();
  });
  it('refuses deletion while children exist', async () => {
    const f = fixture();
    f.categories.findOne.mockResolvedValue({ id: 7, parentId: 0 });
    f.categories.count.mockResolvedValue(1);
    await expect(f.categoryService.deleteCategory(1, 7)).rejects.toMatchObject({ status: 400 });
    expect(f.categories.delete).not.toHaveBeenCalled();
  });
  it('refuses deletion while assets reference the category', async () => {
    const f = fixture();
    f.categories.findOne.mockResolvedValue({ id: 7, parentId: 0 });
    f.assets.count.mockResolvedValue(1);
    await expect(f.categoryService.deleteCategory(1, 7)).rejects.toMatchObject({ status: 400 });
    expect(f.categories.delete).not.toHaveBeenCalled();
  });
});
describe('usage and counter share one transaction', () => {
  it('rejects a missing or foreign asset without saving usage', async () => {
    const f = fixture();
    f.assets.findOne.mockResolvedValue(null);
    await expect(
      f.service.recordUsage(1, { assetId: 99, useType: 'message' }, 2)
    ).rejects.toMatchObject({ status: 404 });
    expect(f.usages.save).not.toHaveBeenCalled();
  });
  it('locks the local asset and saves usage plus increment through transaction repositories', async () => {
    const f = fixture();
    await f.service.recordUsage(1, { assetId: 7, useType: 'message' }, 2);
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.assets.findOne).toHaveBeenCalledWith({
      where: { corpId: 1, id: 7 },
      lock: { mode: 'pessimistic_write' }
    });
    expect(f.manager.getRepository).toHaveBeenCalledWith(AssetUsageEntity);
    expect(f.usages.save).toHaveBeenCalledWith(
      expect.objectContaining({ corpId: 1, assetId: 7, useUserId: 2 })
    );
    expect(f.assets.increment).toHaveBeenCalledWith({ corpId: 1, id: 7 }, 'useCount', 1);
  });
  it('fails if the counter row was not updated', async () => {
    const f = fixture();
    f.assets.increment.mockResolvedValue({ affected: 0 });
    await expect(f.service.recordUsage(1, { assetId: 7, useType: 'message' })).rejects.toThrow();
  });
});
