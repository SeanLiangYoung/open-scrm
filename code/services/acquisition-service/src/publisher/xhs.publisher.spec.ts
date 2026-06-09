import { describe, expect, it } from 'vitest';
import { XhsPublisher } from './xhs.publisher';
import type { PublishContext } from './publisher.types';

function buildContext(overrides: Partial<PublishContext> = {}): PublishContext {
  return {
    content: {
      id: 10,
      corpId: 1,
      accountId: 2,
      platform: 'xiaohongshu',
      contentType: 1,
      title: '测试标题',
      content: '测试正文',
      topics: ['AI'],
      mediaUrls: null,
      coverUrl: null,
      status: 0,
      publishTime: null,
      platformContentId: null,
      createUserId: 1,
      createTime: new Date(),
      updateTime: new Date(),
    },
    account: {
      id: 2,
      corpId: 1,
      platform: 'xiaohongshu',
      accountName: 'demo',
      accountId: 'xhs-demo',
      accessToken: 'token-abc',
      refreshToken: null,
      expiresTime: null,
      status: 1,
      createTime: new Date(),
      updateTime: new Date(),
    },
    ...overrides,
  };
}

describe('XhsPublisher', () => {
  it('publishes graphic draft in mock mode and returns a platform note id', async () => {
    const publisher = new XhsPublisher({ mode: 'mock' });

    const result = await publisher.publish(buildContext());

    expect(result.mode).toBe('mock');
    expect(result.platformContentId).toMatch(/^xhs-mock-/);
    expect(result.publishedAt).toBeInstanceOf(Date);
  });

  it('rejects publish when platform account has no access token', async () => {
    const publisher = new XhsPublisher({ mode: 'mock' });

    await expect(
      publisher.publish(
        buildContext({
          account: {
            ...buildContext().account,
            accessToken: null as unknown as string,
          },
        })
      )
    ).rejects.toThrow('Platform account is not authorized');
  });

  it('rejects unsupported content types for xiaohongshu graphic publish', async () => {
    const publisher = new XhsPublisher({ mode: 'mock' });

    await expect(
      publisher.publish(
        buildContext({
          content: {
            ...buildContext().content,
            contentType: 2,
          },
        })
      )
    ).rejects.toThrow('Unsupported content type for xiaohongshu publish');
  });
});
