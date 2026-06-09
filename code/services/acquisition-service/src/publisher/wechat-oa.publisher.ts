import { MockPlatformPublisher, type MockPublisherOptions } from './mock-platform.publisher';

export class WechatOaPublisher extends MockPlatformPublisher {
  constructor(options: Omit<MockPublisherOptions, 'platformId' | 'idPrefix'> = {}) {
    super({ ...options, platformId: 'wechat', idPrefix: 'wechat' });
  }
}
