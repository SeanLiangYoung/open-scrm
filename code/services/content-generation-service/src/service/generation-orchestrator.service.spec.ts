import { describe, expect, it, vi } from 'vitest';
import { GenerationOrchestrator } from './generation-orchestrator.service';
import type { ContentSourceEntity } from '../entity/content-source.entity';
import type { GenerationJobEntity } from '../entity/generation-job.entity';

describe('GenerationOrchestrator', () => {
  const source: ContentSourceEntity = {
    id: 1,
    corpId: 1,
    title: 'Test Source',
    body: 'Body',
    summary: 'Summary',
    keywords: ['ai'],
    tone: '专业',
    targetAudience: '创作者',
    kbEnabled: true,
    kbQuery: null,
    kbProjectId: 'current',
    kbSelectedPaths: [],
    kbCitations: [],
    composeStatus: 'draft',
    createUserId: 1,
    createTime: new Date(),
    updateTime: new Date(),
  };

  const job: GenerationJobEntity = {
    id: 10,
    corpId: 1,
    sourceId: 1,
    channels: ['tweet', 'xhs_graphic'],
    status: 'pending',
    errorMessage: null,
    llmModel: 'gpt-4o-mini',
    promptVersion: 'v1',
    kbMode: 'off',
    kbHits: 0,
    createTime: new Date(),
    updateTime: new Date(),
  };

  it('generates variants for each channel and attaches citations when KB enabled', async () => {
    const llmComplete = vi
      .fn()
      .mockResolvedValueOnce({
        content:
          '{"title":"Tweet","body":"Hello world","structured":{"thread":[]}}',
      })
      .mockResolvedValueOnce({
        content:
          '{"title":"小红书标题","body":"正文","structured":{"tags":["AI"],"bullets":["要点1"]}}',
      });

    const kbSearch = vi.fn().mockResolvedValue({
      ok: true,
      mode: 'hybrid',
      tokenHits: 1,
      vectorHits: 1,
      results: [
        {
          path: 'wiki/concepts/ai.md',
          title: 'AI',
          snippet: 'about ai',
        },
      ],
    });

    const saveVariant = vi.fn().mockImplementation(async v => ({ ...v, id: Math.random() }));
    const updateJob = vi.fn().mockImplementation(async j => j);

    const orchestrator = new GenerationOrchestrator();
    orchestrator.llmAdapter = { complete: llmComplete };
    orchestrator.kbService = { search: kbSearch } as any;
    orchestrator.variantRepository = { save: saveVariant } as any;
    orchestrator.jobRepository = { save: updateJob } as any;
    orchestrator.promptRegistry = new (await import('../prompt/channel-prompt.registry')).ChannelPromptRegistry();
    orchestrator.promptVersion = 'v1';
    orchestrator.llmModel = 'gpt-4o-mini';

    const result = await orchestrator.runJob(job, source, {
      channels: ['tweet', 'xhs_graphic'],
      kbEnabled: true,
    });

    expect(kbSearch).toHaveBeenCalled();
    expect(llmComplete).toHaveBeenCalledTimes(2);
    expect(saveVariant).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('succeeded');
    expect(result.kbHits).toBe(1);
    expect(result.kbMode).toBe('hybrid');
    expect(result.variants).toHaveLength(2);
    expect(result.variants[0].structured?.citations).toEqual([
      { path: 'wiki/concepts/ai.md', title: 'AI', snippet: 'about ai' },
    ]);
    expect(result.variants[0].qualityFlags?.ai_check_passed).toBe(true);
  });

  it('runs LLM generation for all channels in parallel', async () => {
    const llmComplete = vi.fn().mockImplementation(async () => ({
      content: '{"title":"OK title here","body":"This body is long enough for ai check.","structured":{}}',
    }));
    const saveVariant = vi.fn().mockImplementation(async v => ({ ...v, id: Math.random() }));
    const updateJob = vi.fn().mockImplementation(async j => j);

    const orchestrator = new GenerationOrchestrator();
    orchestrator.llmAdapter = { complete: llmComplete };
    orchestrator.kbService = { search: vi.fn() } as any;
    orchestrator.variantRepository = { save: saveVariant } as any;
    orchestrator.jobRepository = { save: updateJob } as any;
    orchestrator.promptRegistry = new (await import('../prompt/channel-prompt.registry')).ChannelPromptRegistry();

    await orchestrator.runJob(job, source, {
      channels: ['tweet', 'xhs_graphic', 'wechat_article'],
      kbEnabled: false,
    });

    expect(llmComplete).toHaveBeenCalledTimes(3);
    expect(saveVariant).toHaveBeenCalledTimes(3);
  });
});
