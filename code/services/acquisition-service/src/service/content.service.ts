import { Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { ContentEntity } from '../entity/content.entity';
import { CreateContentDto, QueryContentDto } from '../dto/content.dto';
import { mapVariantToContentDraft } from '../util/variant-to-content.util';

@Provide()
export class ContentService {
  @InjectEntityModel(ContentEntity)
  contentRepository!: Repository<ContentEntity>;

  async createDraft(
    corpId: number,
    userId: number | undefined,
    dto: CreateContentDto
  ): Promise<ContentEntity> {
    const content = this.contentRepository.create({
      corpId,
      accountId: dto.accountId,
      platform: dto.platform,
      contentType: dto.contentType,
      title: dto.title ?? null,
      content: dto.content ?? null,
      topics: dto.topics ?? null,
      mediaUrls: dto.mediaUrls ?? null,
      coverUrl: dto.coverUrl ?? null,
      status: 0,
      createUserId: userId ?? null,
    });

    return this.contentRepository.save(content);
  }

  async createDraftFromVariant(
    corpId: number,
    userId: number | undefined,
    input: {
      accountId: number;
      platform: string;
      contentType: number;
      variant: {
        channel: string;
        title?: string | null;
        body?: string | null;
        structured?: Record<string, unknown> | null;
      };
    }
  ): Promise<ContentEntity> {
    const payload = mapVariantToContentDraft({
      corpId,
      accountId: input.accountId,
      platform: input.platform,
      contentType: input.contentType,
      createUserId: userId,
      variant: input.variant,
    });

    const content = this.contentRepository.create(payload);
    return this.contentRepository.save(content);
  }

  async getContent(corpId: number, id: number): Promise<ContentEntity> {
    const content = await this.contentRepository.findOne({ where: { corpId, id } });
    if (!content) {
      throw new Error('Content not found');
    }
    return content;
  }

  async listContents(corpId: number, query: QueryContentDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.contentRepository
      .createQueryBuilder('content')
      .where('content.corpId = :corpId', { corpId });

    if (query.platform) {
      qb.andWhere('content.platform = :platform', { platform: query.platform });
    }
    if (query.status !== undefined) {
      qb.andWhere('content.status = :status', { status: query.status });
    }

    qb.orderBy('content.updateTime', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [list, total] = await qb.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
