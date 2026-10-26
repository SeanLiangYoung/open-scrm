import { it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
vi.mock('../entity/asset.entity', () => ({ AssetEntity: class AssetEntity {} }));
vi.mock('../entity/asset-category.entity', () => ({
  AssetCategoryEntity: class AssetCategoryEntity {}
}));
vi.mock('../entity/asset-usage.entity', () => ({ AssetUsageEntity: class AssetUsageEntity {} }));
import { AssetService } from './asset.service';
const directories: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-upload-unit-'));
  directories.push(dir);
  const filepath = path.join(dir, 'upload.png');
  fs.writeFileSync(filepath, Buffer.from([0, 255, 1, 10]));
  const save = vi.fn(async (asset: any) => Object.assign(asset, { id: '71' }));
  const assets = { create: vi.fn(x => x), save };
  const manager = { getRepository: vi.fn(() => assets) };
  const transaction = vi.fn(async (fn: any) => fn(manager));
  const put = vi.fn(async (key: string) => ({ url: 'http://local.invalid/' + key }));
  const remove = vi.fn(async () => {});
  const service = Object.assign(new AssetService(), {
    assetRepository: { ...assets, manager: { transaction } },
    ossService: { put, delete: remove },
    assetConfig: {
      ossPrefix: 'test-assets',
      allowedTypes: { image: ['image/png'], video: ['video/mp4'], file: ['application/pdf'] },
      maxSize: { image: 10, video: 100, file: 50 }
    }
  });
  return {
    service,
    filepath,
    file: { filepath, filename: 'upload.png', mimeType: 'image/png' },
    put,
    remove,
    save,
    transaction
  };
}
it('successful upload returns persisted metadata and removes temp file', async () => {
  const f = fixture();
  const asset = await f.service.uploadAsset(1, f.file, { name: 'image', type: 1 }, 2);
  expect(asset).toMatchObject({ id: '71', corpId: 1, fileSize: 4, createUserId: 2 });
  expect(fs.existsSync(f.filepath)).toBe(false);
  expect(f.remove).not.toHaveBeenCalled();
});
it('uses distinct object keys even in the same millisecond', async () => {
  const f = fixture(),
    g = fixture();
  vi.spyOn(Date, 'now').mockReturnValue(123);
  await f.service.uploadAsset(1, f.file, { name: 'a', type: 1 });
  await g.service.uploadAsset(1, g.file, { name: 'b', type: 1 });
  expect(f.put.mock.calls[0][0]).not.toBe(g.put.mock.calls[0][0]);
});
it('compensates an object when persistence fails before commit', async () => {
  const f = fixture(),
    error = new Error('database rejected write');
  f.save.mockRejectedValue(error);
  await expect(f.service.uploadAsset(1, f.file, { name: 'a', type: 1 })).rejects.toBe(error);
  expect(f.remove).toHaveBeenCalledWith(f.put.mock.calls[0][0]);
  expect(fs.existsSync(f.filepath)).toBe(false);
});
it('cleans the unique key when OSS times out after a possible write', async () => {
  const f = fixture(),
    error = new Error('upload timeout');
  f.put.mockRejectedValue(error);
  await expect(f.service.uploadAsset(1, f.file, { name: 'a', type: 1 })).rejects.toBe(error);
  expect(f.remove).toHaveBeenCalledWith(f.put.mock.calls[0][0]);
  expect(fs.existsSync(f.filepath)).toBe(false);
});
it('retains primary error and reconciliation key if compensation fails', async () => {
  const f = fixture(),
    error = new Error('database rejected write');
  f.save.mockRejectedValue(error);
  f.remove.mockRejectedValue(new Error('delete timeout'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(f.service.uploadAsset(1, f.file, { name: 'a', type: 1 })).rejects.toBe(error);
  expect(log).toHaveBeenCalledWith(
    'asset-upload-reconciliation-required',
    expect.objectContaining({
      corpId: 1,
      ossPath: f.put.mock.calls[0][0],
      reason: 'compensation-failed'
    })
  );
});
it('does not delete possibly committed object after ambiguous COMMIT failure', async () => {
  const f = fixture(),
    error = new Error('commit connection lost');
  f.transaction.mockImplementation(async fn => {
    await fn({ getRepository: () => ({ save: f.save }) });
    throw error;
  });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(f.service.uploadAsset(1, f.file, { name: 'a', type: 1 })).rejects.toBe(error);
  expect(f.remove).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith(
    'asset-upload-reconciliation-required',
    expect.objectContaining({ reason: 'commit-unknown', ossPath: f.put.mock.calls[0][0] })
  );
  expect(fs.existsSync(f.filepath)).toBe(false);
});
it('temporary cleanup failure does not undo a committed success', async () => {
  const f = fixture();
  vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {
    throw new Error('temporary file busy');
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(f.service.uploadAsset(1, f.file, { name: 'a', type: 1 })).resolves.toMatchObject({
    id: '71'
  });
  expect(f.remove).not.toHaveBeenCalled();
});
it('rejects configured oversize before OSS', async () => {
  const f = fixture();
  fs.writeFileSync(f.filepath, Buffer.alloc(11));
  await expect(f.service.uploadAsset(1, f.file, { name: 'a', type: 1 })).rejects.toMatchObject({
    status: 413
  });
  expect(f.put).not.toHaveBeenCalled();
  expect(fs.existsSync(f.filepath)).toBe(false);
});
it('rejects MIME outside configured asset type before OSS', async () => {
  const f = fixture();
  await expect(
    f.service.uploadAsset(1, { ...f.file, filename: 'document.pdf' }, { name: 'a', type: 1 })
  ).rejects.toMatchObject({ status: 400 });
  expect(f.put).not.toHaveBeenCalled();
  expect(fs.existsSync(f.filepath)).toBe(false);
});
it('accepts the actual Midway file-mode data path and cleans it', async () => {
  const f = fixture();
  await expect(
    f.service.uploadAsset(
      1,
      { data: f.filepath, filename: 'proof.png', mimeType: 'image/png' },
      { name: 'actual middleware', type: 1 }
    )
  ).resolves.toMatchObject({ id: '71' });
  expect(fs.existsSync(f.filepath)).toBe(false);
});
it.each([
  ['clip.avi', 'video/x-msvideo'],
  ['clip.mov', 'video/quicktime']
])('retains configured supported video extension %s', async (filename, mimeType) => {
  const f = fixture();
  const config = (await import('../config/config.default')).default;
  f.service.assetConfig.allowedTypes = config.asset.allowedTypes;
  await expect(
    f.service.uploadAsset(1, { ...f.file, filename, mimeType }, { name: 'video', type: 2 })
  ).resolves.toMatchObject({ id: '71' });
});
