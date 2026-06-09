import { describe, expect, it } from 'vitest';
import { DouyinPublisher } from './douyin.publisher';
import { WechatOaPublisher } from './wechat-oa.publisher';
import { TweetPublisher } from './tweet.publisher';
import type { PublishContext } from './publisher.types';

function buildContext(platform: string, contentType = 1): PublishContext {
  return {
    content: {
      id: 1,
      corpId: 1,
      accountId: 2,
      platform,
      contentType,
      title: '标题',
      content: '正文内容足够长',
      topics: ['话题'],
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
      platform,
      accountName: 'demo',
      accountId: `${platform}-demo`,
      accessToken: 'token',
      refreshToken: null,
      expiresTime: null,
      status: 1,
      createTime: new Date(),
      updateTime: new Date(),
    },
  };
}

describe('DouyinPublisher', () => {
  it('publishes caption draft in mock mode', async () => {
    const result = await new DouyinPublisher({ mode: 'mock' }).publish(
      buildContext('douyin', 1)
    );
    expect(result.platformContentId).toMatch(/^douyin-mock-/);
  });
});

describe('WechatOaPublisher', () => {
  it('publishes article draft in mock mode', async () => {
    const result = await new WechatOaPublisher({ mode: 'mock' }).publish(
      buildContext('wechat', 1)
    );
    expect(result.platformContentId).toMatch(/^wechat-mock-/);
  });
});

describe('TweetPublisher', () => {
  it('publishes tweet draft in mock mode', async () => {
    const result = await new TweetPublisher({ mode: 'mock' }).publish(
      buildContext('twitter', 1)
    );
    expect(result.platformContentId).toMatch(/^twitter-mock-/);
  });
});
