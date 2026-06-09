import { describe, expect, it, vi } from 'vitest';
import { LlmWikiClient } from './llm-wiki.client';

describe('LlmWikiClient', () => {
  const baseUrl = 'http://127.0.0.1:19828';
  const token = 'test-token';

  it('health() calls /api/v1/health without auth header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, status: 'running', version: '0.4.20' }),
    });

    const client = new LlmWikiClient({ baseUrl, token }, fetchMock);
    const result = await client.health();

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/api/v1/health`, {
      method: 'GET',
      headers: {},
    });
    expect(result.status).toBe('running');
  });

  it('search() sends Bearer token and JSON body to project search endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        mode: 'hybrid',
        tokenHits: 2,
        vectorHits: 1,
        results: [
          {
            path: 'wiki/concepts/rope.md',
            title: 'RoPE',
            snippet: 'rotation in attention',
            score: 0.03,
          },
        ],
      }),
    });

    const client = new LlmWikiClient(
      { baseUrl, token, projectId: 'current' },
      fetchMock
    );
    const result = await client.search('rope embedding', { topK: 5, includeContent: true });

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/api/v1/projects/current/search`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'rope embedding',
          topK: 5,
          includeContent: true,
        }),
      }
    );
    expect(result.mode).toBe('hybrid');
    expect(result.results).toHaveLength(1);
  });

  it('search() throws when API returns ok=false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, error: 'Unauthorized' }),
    });

    const client = new LlmWikiClient({ baseUrl, token }, fetchMock);

    await expect(client.search('test')).rejects.toThrow('Unauthorized');
  });

  it('readPage() encodes path query parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        path: 'wiki/concepts/rope.md',
        content: '# RoPE',
      }),
    });

    const client = new LlmWikiClient({ baseUrl, token, projectId: 'current' }, fetchMock);
    const page = await client.readPage('wiki/concepts/rope.md');

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/api/v1/projects/current/files/content?path=${encodeURIComponent('wiki/concepts/rope.md')}`,
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      })
    );
    expect(page.content).toBe('# RoPE');
  });
});
