import { Provide, Inject, Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { ContentSourceEntity } from '../entity/content-source.entity';
import { GenerationJobEntity } from '../entity/generation-job.entity';
import { ContentVariantEntity } from '../entity/content-variant.entity';
import { ContentSourceService } from './content-source.service';
import { LlmWikiKbService } from './llm-wiki-kb.service';
import {
  GenerationOrchestrator,
  type RunJobOptions,
} from './generation-orchestrator.service';
import { OpenAiCompatibleLlmAdapter } from './llm/llm.adapter';
import type { GenerateContentDto } from '../dto/generation.dto';
import type { PushDraftDto } from '../dto/push-draft.dto';
import { AcquisitionClientService } from './acquisition-client.service';

@Provide()
export class GenerationService {
  @InjectEntityModel(GenerationJobEntity)
  jobRepository!: Repository<GenerationJobEntity>;

  @InjectEntityModel(ContentVariantEntity)
  variantRepository!: Repository<ContentVariantEntity>;

  @Inject()
  contentSourceService!: ContentSourceService;

  @Inject()
  llmWikiKbService!: LlmWikiKbService;

  @Inject()
  acquisitionClient!: AcquisitionClientService;

  @Config('contentGeneration')
  contentGenerationConfig!: {
    llmApiBase: string;
    llmApiKey: string;
    llmModel: string;
    promptVersion: string;
  };

  private createOrchestrator(): GenerationOrchestrator {
    const orchestrator = new GenerationOrchestrator();
    orchestrator.llmAdapter = new OpenAiCompatibleLlmAdapter({
      apiBase: this.contentGenerationConfig.llmApiBase,
      apiKey: this.contentGenerationConfig.llmApiKey,
      model: this.contentGenerationConfig.llmModel,
    });
    orchestrator.kbService = this.llmWikiKbService;
    orchestrator.jobRepository = this.jobRepository;
    orchestrator.variantRepository = this.variantRepository;
    orchestrator.llmModel = this.contentGenerationConfig.llmModel;
    orchestrator.promptVersion = this.contentGenerationConfig.promptVersion;
    return orchestrator;
  }

  async startGeneration(
    corpId: number,
    sourceId: number,
    dto: GenerateContentDto
  ) {
    const source = await this.contentSourceService.getSource(corpId, sourceId);

    const job = await this.jobRepository.save(
      this.jobRepository.create({
        corpId,
        sourceId: source.id,
        channels: dto.channels,
        status: 'pending',
        kbMode: 'off',
        kbHits: 0,
        llmModel: this.contentGenerationConfig.llmModel,
        promptVersion: this.contentGenerationConfig.promptVersion,
      })
    );

    const options: RunJobOptions = {
      channels: dto.channels,
      kbEnabled: dto.kbEnabled,
      kbQuery: dto.kbQuery,
    };

    const orchestrator = this.createOrchestrator();
    const result = await orchestrator.runJob(job, source, options);

    return {
      jobId: result.job.id,
      status: result.status,
      kbMode: result.kbMode,
      kbHits: result.kbHits,
      variants: result.variants,
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
    dto: import('../dto/push-draft.dto').PushDraftDto,
    headers: Record<string, string>
  ) {
    const variant = await this.getVariant(corpId, variantId);
    const result = await this.acquisitionClient.pushVariantDraft(
      variant,
      dto,
      headers
    );
    const contentId = result?.data?.id ?? result?.data?.data?.id;
    return {
      variantId: variant.id,
      contentId,
      acquisition: result,
    };
  }
}
