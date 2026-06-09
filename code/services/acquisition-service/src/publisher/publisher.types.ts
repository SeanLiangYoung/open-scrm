import type { ContentEntity } from '../entity/content.entity';
import type { PlatformAccountEntity } from '../entity/platform-account.entity';

export interface PublishContext {
  content: ContentEntity;
  account: PlatformAccountEntity;
}

export interface PublishResult {
  platformContentId: string;
  publishedAt: Date;
  mode: 'mock' | 'live';
}

export interface PlatformPublisher {
  readonly platform: string;
  publish(context: PublishContext): Promise<PublishResult>;
}
