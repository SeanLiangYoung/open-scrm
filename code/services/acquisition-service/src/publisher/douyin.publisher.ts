import { MockPlatformPublisher, type MockPublisherOptions } from './mock-platform.publisher';

export class DouyinPublisher extends MockPlatformPublisher {
  constructor(options: Omit<MockPublisherOptions, 'platformId' | 'idPrefix'> = {}) {
    super({ ...options, platformId: 'douyin', idPrefix: 'douyin', supportedContentTypes: [1, 2] });
  }
}
