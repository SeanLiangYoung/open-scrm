import { describe, expect, it, vi } from 'vitest';
import { ContentSourceService } from './content-source.service';
import type { ContentSourceEntity } from '../entity/content-source.entity';

function makeSource(overrides: Partial<ContentSourceEntity> = {}): ContentSourceEntity {
  return {
    id: 1,
    corpId: 100,
    title: 'Test Source',
    body: null,
    summary: null,
    keywords: null,
    tone: null,
    targetAudience: null,
    kbEnabled: false,
    kbQuery: null,
    kbProjectId: null,
    kbSelectedPaths: [],
    kbCitations: [],
    composeStatus: 'draft',
    createUserId: 1,
    createTime: new Date(),
    updateTime: new Date(),
    ...overrides,
  };
}

describe('ContentSourceService.updateSource', () => {
  it('persists kbSelectedPaths when PATCH includes paths', async () => {
    const source = makeSource();
    const save = vi.fn().mockImplementation(async (entity: ContentSourceEntity) => entity);
    const findOne = vi.fn().mockResolvedValue(source);

    const service = new ContentSourceService();
    service.sourceRepository = {
      findOne,
      save,
    } as any;

    const paths = ['notes/topic-a.md', 'notes/topic-b.md'];
    const updated = await service.updateSource(100, 1, { kbSelectedPaths: paths });

    expect(updated.kbSelectedPaths).toEqual(paths);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ kbSelectedPaths: paths })
    );
  });

  it('persists kbCitations snapshot alongside selected paths', async () => {
    const source = makeSource();
    const save = vi.fn().mockImplementation(async (entity: ContentSourceEntity) => entity);
    const findOne = vi.fn().mockResolvedValue(source);

    const service = new ContentSourceService();
    service.sourceRepository = {
      findOne,
      save,
    } as any;

    const citations = [
      { path: 'notes/topic-a.md', title: 'Topic A', snippet: 'snippet a' },
      { path: 'notes/topic-b.md', title: 'Topic B' },
    ];

    const updated = await service.updateSource(100, 1, {
      kbSelectedPaths: citations.map(c => c.path),
      kbCitations: citations,
    });

    expect(updated.kbCitations).toEqual(citations);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ kbCitations: citations })
    );
  });

  it('returns stored kbSelectedPaths on getSource', async () => {
    const paths = ['notes/saved.md'];
    const source = makeSource({ kbSelectedPaths: paths });
    const findOne = vi.fn().mockResolvedValue(source);

    const service = new ContentSourceService();
    service.sourceRepository = { findOne } as any;

    const result = await service.getSource(100, 1);
    expect(result.kbSelectedPaths).toEqual(paths);
  });
});
