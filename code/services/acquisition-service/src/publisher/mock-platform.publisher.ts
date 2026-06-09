import { randomUUID } from 'crypto';
import type { PlatformPublisher, PublishContext, PublishResult } from './publisher.types';

export interface MockPublisherOptions {
  mode?: 'mock' | 'live';
  platformId: string;
  idPrefix: string;
  supportedContentTypes?: number[];
}

export class MockPlatformPublisher implements PlatformPublisher {
  readonly platform: string;
  private readonly mode: 'mock' | 'live';
  private readonly idPrefix: string;
  private readonly supportedContentTypes: number[];

  constructor(options: MockPublisherOptions) {
    this.platform = options.platformId;
    this.mode = options.mode ?? 'mock';
    this.idPrefix = options.idPrefix;
    this.supportedContentTypes = options.supportedContentTypes ?? [1];
  }

  async publish(context: PublishContext): Promise<PublishResult> {
    if (!context.account.accessToken) {
      throw new Error('Platform account is not authorized');
    }

    if (!this.supportedContentTypes.includes(context.content.contentType)) {
      throw new Error(`Unsupported content type for ${this.platform} publish`);
    }

    if (this.mode === 'mock') {
      return {
        platformContentId: `${this.idPrefix}-mock-${randomUUID()}`,
        publishedAt: new Date(),
        mode: 'mock',
      };
    }

    throw new Error(`${this.platform} live publish is not configured`);
  }
}
