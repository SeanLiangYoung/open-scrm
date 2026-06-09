import { Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { ContentSourceEntity } from '../entity/content-source.entity';
import {
  CreateContentSourceDto,
  ListContentSourceQueryDto,
  UpdateContentSourceDto,
} from '../dto/content-source.dto';

@Provide()
export class ContentSourceService {
  @InjectEntityModel(ContentSourceEntity)
  sourceRepository!: Repository<ContentSourceEntity>;

  async createSource(
    corpId: number,
    userId: number | undefined,
    dto: CreateContentSourceDto
  ): Promise<ContentSourceEntity> {
    const source = this.sourceRepository.create({
      corpId,
      title: dto.title,
      body: dto.body ?? null,
      summary: dto.summary ?? null,
      keywords: dto.keywords ?? null,
      tone: dto.tone ?? null,
      targetAudience: dto.targetAudience ?? null,
      kbEnabled: dto.kbEnabled ?? false,
      kbQuery: dto.kbQuery?.trim() || null,
      kbProjectId: dto.kbProjectId ?? null,
      kbSelectedPaths: dto.kbSelectedPaths ?? [],
      kbCitations: dto.kbCitations ?? [],
      composeStatus: dto.composeStatus ?? 'draft',
      createUserId: userId ?? null,
    });

    return this.sourceRepository.save(source);
  }

  async listSources(corpId: number, query: ListContentSourceQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [list, total] = await this.sourceRepository.findAndCount({
      where: { corpId },
      order: { updateTime: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getSource(corpId: number, id: number): Promise<ContentSourceEntity> {
    const source = await this.sourceRepository.findOne({ where: { corpId, id } });
    if (!source) {
      throw new Error('Content source not found');
    }
    return source;
  }

  async updateSource(
    corpId: number,
    id: number,
    dto: UpdateContentSourceDto
  ): Promise<ContentSourceEntity> {
    const source = await this.getSource(corpId, id);
    Object.assign(source, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.body !== undefined ? { body: dto.body } : {}),
      ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
      ...(dto.keywords !== undefined ? { keywords: dto.keywords } : {}),
      ...(dto.tone !== undefined ? { tone: dto.tone } : {}),
      ...(dto.targetAudience !== undefined
        ? { targetAudience: dto.targetAudience }
        : {}),
      ...(dto.kbEnabled !== undefined ? { kbEnabled: dto.kbEnabled } : {}),
      ...(dto.kbQuery !== undefined
        ? { kbQuery: dto.kbQuery.trim() || null }
        : {}),
      ...(dto.kbProjectId !== undefined ? { kbProjectId: dto.kbProjectId } : {}),
      ...(dto.kbSelectedPaths !== undefined
        ? { kbSelectedPaths: dto.kbSelectedPaths }
        : {}),
      ...(dto.kbCitations !== undefined ? { kbCitations: dto.kbCitations } : {}),
      ...(dto.composeStatus !== undefined ? { composeStatus: dto.composeStatus } : {}),
    });

    return this.sourceRepository.save(source);
  }

  async deleteSource(corpId: number, id: number): Promise<void> {
    const source = await this.getSource(corpId, id);
    await this.sourceRepository.remove(source);
  }
}
