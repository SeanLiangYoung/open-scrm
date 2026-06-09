import { MockPlatformPublisher, type MockPublisherOptions } from './mock-platform.publisher';

export class TweetPublisher extends MockPlatformPublisher {
  constructor(options: Omit<MockPublisherOptions, 'platformId' | 'idPrefix'> = {}) {
    super({ ...options, platformId: 'twitter', idPrefix: 'twitter' });
  }
}
