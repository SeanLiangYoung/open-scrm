import { Processor, IProcessor } from '@midwayjs/bull';
import { Inject } from '@midwayjs/core';
import {
  GenerationJobRunner,
  type GenerationQueuePayload,
} from '../service/generation-job.runner';

@Processor('generation')
export class GenerationQueueProcessor implements IProcessor {
  @Inject()
  generationJobRunner!: GenerationJobRunner;

  async execute(data: GenerationQueuePayload) {
    await this.generationJobRunner.runQueuedJob(data);
  }
}
