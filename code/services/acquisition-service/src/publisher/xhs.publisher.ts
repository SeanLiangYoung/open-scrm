import { randomUUID } from 'crypto';
import type { PlatformPublisher, PublishContext, PublishResult } from './publisher.types';

export interface XhsPublisherOptions {
  mode?: 'mock' | 'live';
  apiBaseUrl?: string;
}

export class XhsPublisher implements PlatformPublisher {
  readonly platform = 'xiaohongshu';
  private readonly mode: 'mock' | 'live';
  private readonly apiBaseUrl: string;

  constructor(options: XhsPublisherOptions = {}) {
    this.mode = options.mode ?? 'mock';
    this.apiBaseUrl = options.apiBaseUrl ?? 'https://open.xiaohongshu.com';
  }

  async publish(context: PublishContext): Promise<PublishResult> {
    if (!context.account.accessToken) {
      throw new Error('Platform account is not authorized');
    }

    if (context.content.contentType !== 1) {
      throw new Error('Unsupported content type for xiaohongshu publish');
    }

    if (this.mode === 'mock') {
      return {
        platformContentId: `xhs-mock-${randomUUID()}`,
        publishedAt: new Date(),
        mode: 'mock',
      };
    }

    // Live mode placeholder — real Open API wiring lands in P4 with credentials + retries.
    throw new Error(
      `XHS live publish is not configured (api=${this.apiBaseUrl}). Set XHS_PUBLISH_MODE=mock for local development.`
    );
  }
}
