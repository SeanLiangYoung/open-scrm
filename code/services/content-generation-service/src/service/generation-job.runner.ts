import { Provide, Config, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { GenerationJobEntity } from '../entity/generation-job.entity';
import { ContentVariantEntity } from '../entity/content-variant.entity';
import { ContentSourceService } from './content-source.service';
import { LlmWikiKbService } from './llm-wiki-kb.service';
import {
  GenerationOrchestrator,
  type RunJobOptions,
} from './generation-orchestrator.service';
import { OpenAiCompatibleLlmAdapter } from './llm/llm.adapter';

export interface GenerationQueuePayload {
  corpId: number;
  jobId: number;
  sourceId: number;
  options: RunJobOptions;
}

@Provide()
export class GenerationJobRunner {
  @InjectEntityModel(GenerationJobEntity)
  jobRepository!: Repository<GenerationJobEntity>;

  @InjectEntityModel(ContentVariantEntity)
  variantRepository!: Repository<ContentVariantEntity>;

  @Inject()
  contentSourceService!: ContentSourceService;

  @Inject()
  llmWikiKbService!: LlmWikiKbService;

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

  async runQueuedJob(payload: GenerationQueuePayload) {
    const job = await this.jobRepository.findOne({
      where: { corpId: payload.corpId, id: payload.jobId },
    });

    if (!job) {
      throw new Error('Generation job not found');
    }

    const source = await this.contentSourceService.getSource(payload.corpId, payload.sourceId);
    const orchestrator = this.createOrchestrator();
    return orchestrator.runJob(job, source, payload.options);
  }
}
