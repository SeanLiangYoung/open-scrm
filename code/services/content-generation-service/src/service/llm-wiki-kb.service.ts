import { Provide, Config } from '@midwayjs/core';
import {
  LlmWikiClient,
  type LlmWikiHealthResponse,
  type LlmWikiSearchResponse,
} from '@scrm/llm-wiki-client';
import { KbSearchDto } from '../dto/kb.dto';

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
}
