import { describe, expect, it, vi } from 'vitest';
import { CONTENT_STATUS } from '../constants/content-status';
import { createPublisherRegistry } from '../publisher/publisher.registry';
import type { PlatformPublisher, PublishResult } from '../publisher/publisher.types';
import { ContentPublishService } from './content-publish.service';
import type { ContentEntity } from '../entity/content.entity';
import type { PlatformAccountEntity } from '../entity/platform-account.entity';

function buildDraft(): ContentEntity {
  return {
    id: 11,
    corpId: 1,
    accountId: 2,
    platform: 'xiaohongshu',
    contentType: 1,
    title: '标题',
    content: '正文',
    topics: ['tag'],
    mediaUrls: null,
    coverUrl: null,
    status: CONTENT_STATUS.DRAFT,
    publishTime: null,
    platformContentId: null,
    createUserId: 1,
    createTime: new Date(),
    updateTime: new Date(),
  };
}

function buildAccount(): PlatformAccountEntity {
  return {
    id: 2,
    corpId: 1,
    platform: 'xiaohongshu',
    accountName: 'demo',
    accountId: 'xhs-demo',
    accessToken: 'token',
    refreshToken: null,
    expiresTime: null,
    status: 1,
    createTime: new Date(),
    updateTime: new Date(),
  };
}

describe('ContentPublishService', () => {
  it('marks draft as published after successful xiaohongshu publish', async () => {
    const draft = buildDraft();
    const account = buildAccount();
    const saved: ContentEntity[] = [];

    const service = new ContentPublishService();
    service.publisherRegistry = createPublisherRegistry({ xhs: { mode: 'mock' } });
    service.contentRepository = {
      findOne: vi.fn(async () => draft),
      save: vi.fn(async (entity: ContentEntity) => {
        saved.push({ ...entity });
        return entity;
      }),
    } as unknown as ContentPublishService['contentRepository'];
    service.platformAccountRepository = {
      findOne: vi.fn(async () => account),
    } as unknown as ContentPublishService['platformAccountRepository'];

    const result = await service.publishContent(1, draft.id);

    expect(result.status).toBe(CONTENT_STATUS.PUBLISHED);
    expect(result.platformContentId).toMatch(/^xhs-mock-/);
    expect(result.publishTime).toBeInstanceOf(Date);
    expect(saved.at(-1)?.status).toBe(CONTENT_STATUS.PUBLISHED);
  });

  it('marks content as failed when publisher throws', async () => {
    const draft = buildDraft();
    const failingPublisher: PlatformPublisher = {
      platform: 'xiaohongshu',
      publish: vi.fn(async () => {
        throw new Error('upstream rejected');
      }),
    };

    const service = new ContentPublishService();
    service.publisherRegistry = new Map([['xiaohongshu', failingPublisher]]);
    service.contentRepository = {
      findOne: vi.fn(async () => draft),
      save: vi.fn(async (entity: ContentEntity) => entity),
    } as unknown as ContentPublishService['contentRepository'];
    service.platformAccountRepository = {
      findOne: vi.fn(async () => buildAccount()),
    } as unknown as ContentPublishService['platformAccountRepository'];

    await expect(service.publishContent(1, draft.id)).rejects.toThrow('upstream rejected');

    const lastSave = (service.contentRepository.save as ReturnType<typeof vi.fn>).mock
      .calls.at(-1)?.[0] as ContentEntity;
    expect(lastSave.status).toBe(CONTENT_STATUS.FAILED);
  });

  it('rejects publish when content is not a draft', async () => {
    const service = new ContentPublishService();
    service.publisherRegistry = createPublisherRegistry();
    service.contentRepository = {
      findOne: vi.fn(async () => ({ ...buildDraft(), status: CONTENT_STATUS.PUBLISHED })),
      save: vi.fn(),
    } as unknown as ContentPublishService['contentRepository'];
    service.platformAccountRepository = {
      findOne: vi.fn(),
    } as unknown as ContentPublishService['platformAccountRepository'];

    await expect(service.publishContent(1, 11)).rejects.toThrow('Only draft content can be published');
  });

  it('batchPublish returns per-item results and continues after a failure', async () => {
    const draft = buildDraft();
    const account = buildAccount();
    let callCount = 0;

    const service = new ContentPublishService();
    service.publisherRegistry = createPublisherRegistry({ xhs: { mode: 'mock' } });
    service.publishContent = vi.fn(async (_corpId, contentId) => {
      callCount += 1;
      if (contentId === 12) {
        throw new Error('publish failed');
      }
      return { ...draft, id: contentId, status: CONTENT_STATUS.PUBLISHED };
    }) as unknown as ContentPublishService['publishContent'];

    const results = await service.batchPublish(1, [11, 12, 13]);

    expect(callCount).toBe(3);
    expect(results).toEqual([
      { contentId: 11, success: true, content: expect.objectContaining({ id: 11 }) },
      { contentId: 12, success: false, error: 'publish failed' },
      { contentId: 13, success: true, content: expect.objectContaining({ id: 13 }) },
    ]);
  });
});
