import { describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleLlmAdapter } from './llm.adapter';

describe('OpenAiCompatibleLlmAdapter', () => {
  it('complete() posts chat completion request and returns assistant content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"title":"Hi","body":"Hello"}' } }],
      }),
    });

    const adapter = new OpenAiCompatibleLlmAdapter(
      {
        apiBase: 'https://api.example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      },
      fetchMock
    );

    const result = await adapter.complete({
      system: 'Return JSON',
      user: 'Write a tweet',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
        body: expect.not.stringContaining('"temperature"'),
      })
    );
    expect(result.content).toContain('"title":"Hi"');
  });

  it('includes temperature when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"title":"Hi","body":"Hello"}' } }],
      }),
    });

    const adapter = new OpenAiCompatibleLlmAdapter(
      {
        apiBase: 'https://api.example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        temperature: 0.7,
      },
      fetchMock
    );

    await adapter.complete({ system: 'Return JSON', user: 'Write a tweet' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"temperature":0.7'),
      })
    );
  });
});
