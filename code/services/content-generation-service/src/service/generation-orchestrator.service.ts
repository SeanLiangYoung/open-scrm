import { buildKbSearchQuery } from '@scrm/llm-wiki-client';
import type { ContentChannel } from '@scrm/shared-constants';
import { assertContentChannels } from '@scrm/shared-constants';
import type { ContentSourceEntity } from '../entity/content-source.entity';
import type { GenerationJobEntity } from '../entity/generation-job.entity';
import type { ContentVariantEntity } from '../entity/content-variant.entity';
import { ChannelPromptRegistry } from '../prompt/channel-prompt.registry';
import { applyChannelPostProcess } from '../prompt/post-process/channel-post-process.util';
import { runAiCheck } from '../prompt/post-process/ai-check.util';
import { toCitationRecords } from '../util/citations.util';
import type { LlmAdapter } from './llm/llm.adapter';
import type { LlmWikiKbService } from './llm-wiki-kb.service';

export interface RunJobOptions {
  channels: string[];
  kbEnabled?: boolean;
  kbQuery?: string;
}

export interface RunJobResult {
  job: GenerationJobEntity;
  variants: ContentVariantEntity[];
  status: GenerationJobEntity['status'];
  kbMode: string;
  kbHits: number;
}

interface ParsedVariantPayload {
  title?: string;
  body?: string;
  structured?: Record<string, unknown>;
}

export class GenerationOrchestrator {
  llmAdapter!: LlmAdapter;
  kbService!: LlmWikiKbService;
  promptRegistry = new ChannelPromptRegistry();
  variantRepository!: { save: (v: Partial<ContentVariantEntity>) => Promise<ContentVariantEntity> };
  jobRepository!: { save: (j: GenerationJobEntity) => Promise<GenerationJobEntity> };
  promptVersion = 'v1';
  llmModel = 'gpt-4o-mini';

  async runJob(
    job: GenerationJobEntity,
    source: ContentSourceEntity,
    options: RunJobOptions
  ): Promise<RunJobResult> {
    const channels = assertContentChannels(options.channels);
    const useKb = options.kbEnabled ?? source.kbEnabled;

    job.status = 'running';
    await this.jobRepository.save(job);

    let kbMode = 'off';
    let kbHits = 0;
    let kbContext = '';
    let citations: ReturnType<typeof toCitationRecords> = [];

    if (useKb) {
      if (source.kbSelectedPaths?.length) {
        const pages = await this.kbService.readPages(
          source.kbSelectedPaths,
          source.kbProjectId ?? undefined
        );
        kbMode = 'selected';
        kbHits = pages.length;
        citations = pages.map(page => ({
          path: page.path,
          title: page.title,
          snippet: page.content.slice(0, 200),
        }));
        kbContext = pages
          .map(page => `- [[${page.path}]] ${page.title}:\n${page.content}`)
          .join('\n\n');
      } else {
        const query = buildKbSearchQuery({
          title: source.title,
          keywords: source.keywords ?? undefined,
          kbQuery: options.kbQuery ?? source.kbQuery,
        });

        if (query) {
          const searchResult = await this.kbService.search({
            query,
            topK: 5,
            includeContent: true,
            projectId: source.kbProjectId ?? undefined,
          });
          kbMode = searchResult.mode ?? 'keyword';
          kbHits = searchResult.results.length;
          citations = toCitationRecords(searchResult.results);
          kbContext = searchResult.results
            .map(r => `- [[${r.path}]] ${r.title}: ${r.snippet}`)
            .join('\n');
        }
      }
    }

    job.kbMode = kbMode;
    job.kbHits = kbHits;

    const promptContext = {
      title: source.title,
      body: source.body,
      summary: source.summary,
      keywords: source.keywords,
      tone: source.tone,
      targetAudience: source.targetAudience,
      kbContext,
    };

    const variants: ContentVariantEntity[] = [];

    try {
      const variantResults = await Promise.all(
        channels.map(async channel => {
          const prompt = this.promptRegistry.build(channel as ContentChannel, promptContext);
          const llmResult = await this.llmAdapter.complete(prompt);
          const parsed = applyChannelPostProcess(
            channel as ContentChannel,
            this.parseVariantPayload(llmResult.content)
          );

          const structured = {
            ...(parsed.structured ?? {}),
            ...(citations.length ? { citations } : {}),
          };

          const aiCheck = runAiCheck({
            title: parsed.title ?? null,
            body: parsed.body ?? llmResult.content,
          });

          return this.variantRepository.save({
            corpId: source.corpId,
            jobId: job.id,
            sourceId: source.id,
            channel,
            title: parsed.title ?? null,
            body: parsed.body ?? llmResult.content,
            structured,
            qualityFlags: {
              ai_check_passed: aiCheck.passed,
              ai_check_issues: aiCheck.issues,
            },
            version: 1,
          });
        })
      );

      variants.push(...variantResults);

      job.status = 'succeeded';
      job.errorMessage = null;
    } catch (error: unknown) {
      job.status = 'failed';
      job.errorMessage = error instanceof Error ? error.message : 'Generation failed';
    }

    job.llmModel = this.llmModel;
    job.promptVersion = this.promptVersion;
    const savedJob = await this.jobRepository.save(job);

    return {
      job: savedJob,
      variants,
      status: savedJob.status,
      kbMode,
      kbHits,
    };
  }

  private parseVariantPayload(raw: string): ParsedVariantPayload {
    const trimmed = raw.trim();
    const jsonText = trimmed.startsWith('```')
      ? trimmed.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      : trimmed;

    try {
      return JSON.parse(jsonText) as ParsedVariantPayload;
    } catch {
      return { body: raw };
    }
  }
}
