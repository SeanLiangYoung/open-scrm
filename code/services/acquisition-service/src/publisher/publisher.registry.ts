import type { PlatformPublisher } from './publisher.types';
import { XhsPublisher, type XhsPublisherOptions } from './xhs.publisher';
import { DouyinPublisher } from './douyin.publisher';
import { WechatOaPublisher } from './wechat-oa.publisher';
import { TweetPublisher } from './tweet.publisher';

export interface PublisherRegistryOptions {
  xhs?: XhsPublisherOptions;
  publishMode?: 'mock' | 'live';
}

export function createPublisherRegistry(
  options: PublisherRegistryOptions = {}
): Map<string, PlatformPublisher> {
  const mode = options.publishMode ?? 'mock';
  const publishers: PlatformPublisher[] = [
    new XhsPublisher({ ...options.xhs, mode }),
    new DouyinPublisher({ mode }),
    new WechatOaPublisher({ mode }),
    new TweetPublisher({ mode }),
  ];

  return new Map(publishers.map(publisher => [publisher.platform, publisher]));
}

export function resolvePublisher(
  registry: Map<string, PlatformPublisher>,
  platform: string
): PlatformPublisher {
  const publisher = registry.get(platform);
  if (!publisher) {
    throw new Error(`No publisher registered for platform: ${platform}`);
  }
  return publisher;
}
