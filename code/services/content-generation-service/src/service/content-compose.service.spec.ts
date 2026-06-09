import { describe, expect, it, vi } from 'vitest';
import { ContentComposeService } from './content-compose.service';

describe('ContentComposeService', () => {
  it('reads wiki pages, calls LLM, and writes composed core draft to source', async () => {
    const paths = ['notes/topic-a.md', 'notes/topic-b.md'];
    const llmResponse = {
      title: 'Composed Title',
      summary: 'Composed summary',
      body: 'Composed body from wiki pages.',
      keywords: ['wiki', 'compose'],
    };

    const readPages = vi.fn().mockResolvedValue([
      { path: paths[0], title: 'Topic A', content: '# Topic A\n\nA content.' },
      { path: paths[1], title: 'Topic B', content: '# Topic B\n\nB content.' },
    ]);
    const llmComplete = vi.fn().mockResolvedValue({
      content: JSON.stringify(llmResponse),
    });
    const updateSource = vi.fn().mockImplementation(async (_corpId, _id, patch) => ({
      id: 1,
      corpId: 100,
      ...patch,
      composeStatus: 'composed',
    }));
    const getSource = vi.fn().mockResolvedValue({
      id: 1,
      corpId: 100,
      title: 'Draft',
      kbSelectedPaths: [],
      kbProjectId: 'current',
    });

    const service = new ContentComposeService();
    service.kbService = { readPages } as any;
    service.llmAdapter = { complete: llmComplete };
    service.contentSourceService = { getSource, updateSource } as any;

    const result = await service.compose(100, 1, { paths, tone: '专业' });

    expect(readPages).toHaveBeenCalledWith(paths, 'current');
    expect(llmComplete).toHaveBeenCalled();
    expect(updateSource).toHaveBeenCalledWith(
      100,
      1,
      expect.objectContaining({
        title: llmResponse.title,
        body: llmResponse.body,
        summary: llmResponse.summary,
        keywords: llmResponse.keywords,
        kbSelectedPaths: paths,
        composeStatus: 'composed',
      })
    );
    expect(result.title).toBe(llmResponse.title);
    expect(result.composeStatus).toBe('composed');
    expect(result.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: paths[0], title: 'Topic A' }),
        expect.objectContaining({ path: paths[1], title: 'Topic B' }),
      ])
    );
  });

  it('rejects when more than 5 paths are requested', async () => {
    const service = new ContentComposeService();
    service.contentSourceService = {
      getSource: vi.fn().mockResolvedValue({ id: 1, corpId: 100, kbProjectId: null }),
    } as any;

    const paths = Array.from({ length: 6 }, (_, i) => `notes/p${i}.md`);
    await expect(service.compose(100, 1, { paths })).rejects.toThrow(/5/);
  });
});
