import { Provide, Config } from '@midwayjs/core';
import {
  LlmWikiClient,
  type LlmWikiHealthResponse,
  type LlmWikiSearchResponse,
} from '@scrm/llm-wiki-client';
import { KbSearchDto } from '../dto/kb.dto';
import { extractPageTitle, truncatePageContent, MAX_COMPOSE_PAGES } from '../util/core-compose.util';

@Provide()
export class LlmWikiKbService {
  @Config('contentGeneration')
  contentGenerationConfig!: {
    llmWikiBaseUrl: string;
    llmWikiApiToken: string;
    llmWikiProjectId: string;
  };

  createClient(projectId?: string): LlmWikiClient {
    return new LlmWikiClient({
      baseUrl: this.contentGenerationConfig.llmWikiBaseUrl,
      token: this.contentGenerationConfig.llmWikiApiToken || undefined,
      projectId: projectId || this.contentGenerationConfig.llmWikiProjectId,
    });
  }

  async getHealthStatus(): Promise<
    LlmWikiHealthResponse & {
      configured: boolean;
      tokenConfigured: boolean;
    }
  > {
    const health = await this.createClient().health();
    const tokenConfigured = Boolean(this.contentGenerationConfig.llmWikiApiToken);

    return {
      ...health,
      configured: Boolean(this.contentGenerationConfig.llmWikiBaseUrl),
      tokenConfigured,
    };
  }

  async search(dto: KbSearchDto): Promise<LlmWikiSearchResponse> {
    if (!this.contentGenerationConfig.llmWikiApiToken) {
      throw new Error('KB_UNAVAILABLE: LLM_WIKI_API_TOKEN is not configured');
    }

    const client = this.createClient(dto.projectId);
    return client.search(dto.query, {
      topK: dto.topK ?? 10,
      includeContent: dto.includeContent ?? false,
    });
  }

  async readPages(
    paths: string[],
    projectId?: string
  ): Promise<Array<{ path: string; title: string; content: string }>> {
    if (!this.contentGenerationConfig.llmWikiApiToken) {
      throw new Error('KB_UNAVAILABLE: LLM_WIKI_API_TOKEN is not configured');
    }

    const limitedPaths = paths.slice(0, MAX_COMPOSE_PAGES);
    const client = this.createClient(projectId);

    const pages = await Promise.all(
      limitedPaths.map(async path => {
        const page = await client.readPage(path);
        if (!page.ok) {
          throw new Error(`KB_READ_FAILED: unable to read ${path}`);
        }
        const content = truncatePageContent(page.content ?? '');
        return {
          path: page.path,
          title: extractPageTitle(page.path, content),
          content,
        };
      })
    );

    return pages;
  }
}
