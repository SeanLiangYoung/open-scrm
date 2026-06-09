import { Provide, Inject, Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { InjectQueue } from '@midwayjs/bull';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import { GenerationJobEntity } from '../entity/generation-job.entity';
import { ContentVariantEntity } from '../entity/content-variant.entity';
import { VariantPublishLinkEntity } from '../entity/variant-publish-link.entity';
import { ContentSourceService } from './content-source.service';
import type { GenerateContentDto } from '../dto/generation.dto';
import type { PushDraftDto } from '../dto/push-draft.dto';
import { AcquisitionClientService } from './acquisition-client.service';
import { GenerationJobRunner, type GenerationQueuePayload } from './generation-job.runner';

@Provide()
export class GenerationService {
  @InjectEntityModel(GenerationJobEntity)
  jobRepository!: Repository<GenerationJobEntity>;

  @InjectEntityModel(ContentVariantEntity)
  variantRepository!: Repository<ContentVariantEntity>;

  @InjectEntityModel(VariantPublishLinkEntity)
  variantPublishLinkRepository!: Repository<VariantPublishLinkEntity>;

  @Inject()
  contentSourceService!: ContentSourceService;

  @Inject()
  generationJobRunner!: GenerationJobRunner;

  @Inject()
  acquisitionClient!: AcquisitionClientService;

  @InjectQueue('generation')
  generationQueue!: Queue;

  @Config('contentGeneration')
  contentGenerationConfig!: {
    llmApiBase: string;
    llmApiKey: string;
    llmModel: string;
    promptVersion: string;
    syncGeneration: boolean;
  };

  async startGeneration(
    corpId: number,
    sourceId: number,
    dto: GenerateContentDto
  ) {
    await this.contentSourceService.getSource(corpId, sourceId);

    const job = await this.jobRepository.save(
      this.jobRepository.create({
        corpId,
        sourceId,
        channels: dto.channels,
        status: 'pending',
        kbMode: 'off',
        kbHits: 0,
        llmModel: this.contentGenerationConfig.llmModel,
        promptVersion: this.contentGenerationConfig.promptVersion,
      })
    );

    const payload: GenerationQueuePayload = {
      corpId,
      jobId: job.id,
      sourceId,
      options: {
        channels: dto.channels,
        kbEnabled: dto.kbEnabled,
        kbQuery: dto.kbQuery,
      },
    };

    if (this.contentGenerationConfig.syncGeneration) {
      const result = await this.generationJobRunner.runQueuedJob(payload);
      return {
        jobId: result.job.id,
        status: result.status,
        kbMode: result.kbMode,
        kbHits: result.kbHits,
        variants: result.variants,
      };
    }

    await this.generationQueue.add(payload);

    return {
      jobId: job.id,
      status: job.status,
      kbMode: job.kbMode,
      kbHits: job.kbHits,
      variants: [],
    };
  }

  async getJob(corpId: number, jobId: number) {
    const job = await this.jobRepository.findOne({ where: { corpId, id: jobId } });
    if (!job) {
      throw new Error('Generation job not found');
    }

    const variants = await this.variantRepository.find({
      where: { corpId, jobId },
      order: { id: 'ASC' },
    });

    return { job, variants };
  }

  async getVariant(corpId: number, variantId: number) {
    const variant = await this.variantRepository.findOne({
      where: { corpId, id: variantId },
    });
    if (!variant) {
      throw new Error('Content variant not found');
    }
    return variant;
  }

  async updateVariant(
    corpId: number,
    variantId: number,
    patch: { title?: string; body?: string; structured?: Record<string, unknown> }
  ) {
    const variant = await this.getVariant(corpId, variantId);
    Object.assign(variant, {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.structured !== undefined ? { structured: patch.structured } : {}),
      version: variant.version + 1,
    });
    return this.variantRepository.save(variant);
  }

  async pushVariantDraft(
    corpId: number,
    variantId: number,
    dto: PushDraftDto,
    headers: Record<string, string>
  ) {
    const variant = await this.getVariant(corpId, variantId);
    const result = await this.acquisitionClient.pushVariantDraft(
      variant,
      dto,
      headers
    );
    const contentId = result?.data?.id ?? result?.data?.data?.id;

    if (contentId) {
      await this.variantPublishLinkRepository.save(
        this.variantPublishLinkRepository.create({
          corpId,
          variantId: variant.id,
          contentId: Number(contentId),
          platform: dto.platform,
        })
      );
    }

    return {
      variantId: variant.id,
      contentId,
      acquisition: result,
    };
  }
}
