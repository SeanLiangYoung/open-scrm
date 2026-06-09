import { Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { CONTENT_STATUS } from '../constants/content-status';
import { ContentEntity } from '../entity/content.entity';
import { PlatformAccountEntity } from '../entity/platform-account.entity';
import { createPublisherRegistry, resolvePublisher } from '../publisher/publisher.registry';
import type { PlatformPublisher } from '../publisher/publisher.types';

@Provide()
export class ContentPublishService {
  @InjectEntityModel(ContentEntity)
  contentRepository!: Repository<ContentEntity>;

  @InjectEntityModel(PlatformAccountEntity)
  platformAccountRepository!: Repository<PlatformAccountEntity>;

  publisherRegistry: Map<string, PlatformPublisher> = createPublisherRegistry({
    xhs: { mode: (process.env.XHS_PUBLISH_MODE as 'mock' | 'live') || 'mock' },
    publishMode: (process.env.PLATFORM_PUBLISH_MODE as 'mock' | 'live') || 'mock',
  });

  async publishContent(corpId: number, contentId: number): Promise<ContentEntity> {
    const content = await this.contentRepository.findOne({
      where: { corpId, id: contentId },
    });

    if (!content) {
      throw new Error('Content not found');
    }

    if (content.status !== CONTENT_STATUS.DRAFT) {
      throw new Error('Only draft content can be published');
    }

    const account = await this.platformAccountRepository.findOne({
      where: { corpId, id: content.accountId },
    });

    if (!account) {
      throw new Error('Platform account not found');
    }

    if (account.platform !== content.platform) {
      throw new Error('Platform account does not match content platform');
    }

    content.status = CONTENT_STATUS.PUBLISHING;
    await this.contentRepository.save(content);

    const publisher = resolvePublisher(this.publisherRegistry, content.platform);

    try {
      const result = await publisher.publish({ content, account });
      content.status = CONTENT_STATUS.PUBLISHED;
      content.platformContentId = result.platformContentId;
      content.publishTime = result.publishedAt;
      return this.contentRepository.save(content);
    } catch (error) {
      content.status = CONTENT_STATUS.FAILED;
      await this.contentRepository.save(content);
      throw error;
    }
  }

  async getPublishStatus(corpId: number, contentId: number) {
    const content = await this.contentRepository.findOne({
      where: { corpId, id: contentId },
    });

    if (!content) {
      throw new Error('Content not found');
    }

    return {
      id: content.id,
      status: content.status,
      platform: content.platform,
      platformContentId: content.platformContentId,
      publishTime: content.publishTime,
      updatedAt: content.updateTime,
    };
  }
}
