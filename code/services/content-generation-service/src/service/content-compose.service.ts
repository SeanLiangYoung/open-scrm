import { Provide, Config, Inject } from '@midwayjs/core';
import { CoreComposePromptRegistry } from '../prompt/core-compose-prompt.registry';
import type { CoreComposeLlmResult } from '../prompt/core-compose-prompt.types';
import type { ComposeContentSourceDto } from '../dto/compose.dto';
import { ContentSourceService } from './content-source.service';
import { LlmWikiKbService } from './llm-wiki-kb.service';
import type { LlmAdapter } from './llm/llm.adapter';
import { createLlmAdapter } from './llm/create-llm-adapter';
import { MAX_COMPOSE_PAGES, parseCoreComposePayload } from '../util/core-compose.util';

export interface ComposeResult extends CoreComposeLlmResult {
  citations: Array<{ path: string; title: string; snippet?: string }>;
  composeStatus: 'composed';
}

@Provide()
export class ContentComposeService {
  @Inject()
  contentSourceService!: ContentSourceService;

  @Inject()
  kbService!: LlmWikiKbService;

  @Config('contentGeneration')
  contentGenerationConfig!: {
    llmApiBase: string;
    llmApiKey: string;
    llmModel: string;
    mockLlm: boolean;
  };

  promptRegistry = new CoreComposePromptRegistry();
  llmAdapter!: LlmAdapter;

  private getLlmAdapter(): LlmAdapter {
    if (!this.llmAdapter) {
      this.llmAdapter = createLlmAdapter({
        mockLlm: this.contentGenerationConfig.mockLlm,
        apiBase: this.contentGenerationConfig.llmApiBase,
        apiKey: this.contentGenerationConfig.llmApiKey,
        model: this.contentGenerationConfig.llmModel,
      });
    }
    return this.llmAdapter;
  }

  async compose(
    corpId: number,
    sourceId: number,
    dto: ComposeContentSourceDto
  ): Promise<ComposeResult> {
    const source = await this.contentSourceService.getSource(corpId, sourceId);
    const paths = dto.paths ?? source.kbSelectedPaths ?? [];

    if (!paths.length) {
      throw new Error('At least one wiki path is required to compose');
    }
    if (paths.length > MAX_COMPOSE_PAGES) {
      throw new Error(`At most ${MAX_COMPOSE_PAGES} wiki pages can be composed at once`);
    }

    const projectId = source.kbProjectId ?? undefined;
    const pages = await this.kbService.readPages(paths, projectId);
    const prompt = this.promptRegistry.build(pages, {
      tone: dto.tone ?? source.tone ?? undefined,
      targetAudience: dto.targetAudience ?? source.targetAudience ?? undefined,
      instruction: dto.instruction,
    });

    const llmResult = await this.getLlmAdapter().complete(prompt);
    const composed = parseCoreComposePayload(llmResult.content);
    const citations = pages.map(page => ({
      path: page.path,
      title: page.title,
      snippet: page.content.slice(0, 200),
    }));

    await this.contentSourceService.updateSource(corpId, sourceId, {
      title: composed.title,
      body: composed.body,
      summary: composed.summary,
      keywords: composed.keywords,
      kbSelectedPaths: paths,
      kbCitations: citations,
      composeStatus: 'composed',
      ...(dto.tone !== undefined ? { tone: dto.tone } : {}),
      ...(dto.targetAudience !== undefined ? { targetAudience: dto.targetAudience } : {}),
    });

    return {
      ...composed,
      citations,
      composeStatus: 'composed',
    };
  }
}
