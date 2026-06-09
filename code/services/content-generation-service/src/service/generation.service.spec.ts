import { describe, expect, it, vi } from 'vitest';
import { GenerationService } from './generation.service';

describe('GenerationService.batchPushDrafts', () => {
  it('pushes each variant and returns per-item results without stopping on failure', async () => {
    const getSource = vi.fn().mockResolvedValue({ id: 10, corpId: 1 });
    const getVariant = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, corpId: 1, sourceId: 10, channel: 'tweet' })
      .mockResolvedValueOnce({ id: 2, corpId: 1, sourceId: 10, channel: 'xhs_graphic' });
    const pushVariantDraft = vi
      .fn()
      .mockResolvedValueOnce({ variantId: 1, contentId: 101 })
      .mockRejectedValueOnce(new Error('account mismatch'));

    const service = new GenerationService();
    service.contentSourceService = { getSource } as any;
    service.getVariant = getVariant as any;
    service.pushVariantDraft = pushVariantDraft as any;

    const results = await service.batchPushDrafts(
      1,
      10,
      {
        items: [
          { variantId: 1, platform: 'twitter', accountId: 1, contentType: 1 },
          { variantId: 2, platform: 'xiaohongshu', accountId: 2, contentType: 1 },
        ],
      },
      {}
    );

    expect(getSource).toHaveBeenCalledWith(1, 10);
    expect(pushVariantDraft).toHaveBeenCalledTimes(2);
    expect(results).toEqual([
      { variantId: 1, success: true, contentId: 101 },
      { variantId: 2, success: false, error: 'account mismatch' },
    ]);
  });

  it('rejects variants that do not belong to the source', async () => {
    const service = new GenerationService();
    service.contentSourceService = {
      getSource: vi.fn().mockResolvedValue({ id: 10, corpId: 1 }),
    } as any;
    service.getVariant = vi.fn().mockResolvedValue({
      id: 3,
      corpId: 1,
      sourceId: 99,
      channel: 'tweet',
    }) as any;
    service.pushVariantDraft = vi.fn() as any;

    const results = await service.batchPushDrafts(
      1,
      10,
      { items: [{ variantId: 3, platform: 'twitter', accountId: 1, contentType: 1 }] },
      {}
    );

    expect(results[0]).toMatchObject({
      variantId: 3,
      success: false,
      error: expect.stringContaining('source'),
    });
  });
});
