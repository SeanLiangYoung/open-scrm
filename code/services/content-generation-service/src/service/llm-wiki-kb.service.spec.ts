import { describe, expect, it, vi } from 'vitest';
import { LlmWikiKbService } from './llm-wiki-kb.service';

describe('LlmWikiKbService', () => {
  it('search() rejects when API token is not configured', async () => {
    const service = new LlmWikiKbService();
    service.contentGenerationConfig = {
      llmWikiBaseUrl: 'http://127.0.0.1:19828',
      llmWikiApiToken: '',
      llmWikiProjectId: 'current',
    };

    await expect(
      service.search({ query: 'rope embedding', topK: 5 })
    ).rejects.toThrow('KB_UNAVAILABLE');
  });

  it('getHealthStatus() reports tokenConfigured flag', async () => {
    const service = new LlmWikiKbService();
    service.contentGenerationConfig = {
      llmWikiBaseUrl: 'http://127.0.0.1:19828',
      llmWikiApiToken: 'secret',
      llmWikiProjectId: 'current',
    };

    const originalClient = service.createClient.bind(service);
    service.createClient = () =>
      ({
        health: vi.fn().mockResolvedValue({
          ok: true,
          status: 'running',
          version: '0.4.20',
        }),
      }) as ReturnType<typeof originalClient>;

    const status = await service.getHealthStatus();
    expect(status.tokenConfigured).toBe(true);
    expect(status.status).toBe('running');
  });
});
