import { it, expect, vi } from 'vitest';
vi.mock('../entity/asset.entity', () => ({ AssetEntity: class AssetEntity {} }));
vi.mock('../entity/asset-category.entity', () => ({
  AssetCategoryEntity: class AssetCategoryEntity {}
}));
vi.mock('../entity/asset-usage.entity', () => ({ AssetUsageEntity: class AssetUsageEntity {} }));
import { AssetController } from './asset.controller';
function fixture() {
  const uploadAsset = vi.fn().mockResolvedValue({ id: '71' });
  const c = Object.assign(new AssetController(), {
    ctx: { state: { user: { corpId: 1, userId: 2 } }, get: () => '' },
    assetService: { uploadAsset }
  });
  return { c, uploadAsset };
}
const file = { filename: 'image.png' };
it.each([
  { type: '1e0' },
  { type: '1tail' },
  { type: '0x1' },
  { type: ['1', '2'] },
  { type: '1', tags: 'bad json' },
  { type: '1', tags: '{}' },
  { type: '1', tags: '[1]' },
  { type: '1', corpId: '2' },
  { type: '1', name: ['a', 'b'] }
])('rejects malformed multipart metadata %j before upload', async fields => {
  const f = fixture();
  await expect(f.c.uploadAsset([file], fields)).rejects.toMatchObject({ status: 400 });
  expect(f.uploadAsset).not.toHaveBeenCalled();
});
it('rejects multiple files instead of silently discarding the rest', async () => {
  const f = fixture();
  await expect(f.c.uploadAsset([file, file], { type: '1' })).rejects.toMatchObject({ status: 400 });
  expect(f.uploadAsset).not.toHaveBeenCalled();
});
it('accepts canonical multipart fields and parses tags as a JSON string array', async () => {
  const f = fixture();
  await f.c.uploadAsset([file], { type: '1', categoryId: '31', tags: '["one"]' });
  expect(f.uploadAsset).toHaveBeenCalledWith(
    1,
    file,
    { name: 'image.png', type: 1, categoryId: 31, tags: ['one'] },
    2
  );
});
it('propagates payload-size413 rather than reporting HTTP success', async () => {
  const f = fixture();
  f.uploadAsset.mockRejectedValue(Object.assign(new Error('too large'), { status: 413 }));
  await expect(f.c.uploadAsset([file], { type: '1' })).rejects.toMatchObject({ status: 413 });
});
