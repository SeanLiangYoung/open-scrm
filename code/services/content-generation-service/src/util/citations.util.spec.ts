import { describe, expect, it } from 'vitest';
import { toCitationRecords } from './citations.util';
import type { LlmWikiSearchResult } from '@scrm/llm-wiki-client';

describe('toCitationRecords', () => {
  it('maps search hits to citation metadata without full page content', () => {
    const hits: LlmWikiSearchResult[] = [
      {
        path: 'wiki/concepts/rope.md',
        title: 'RoPE',
        snippet: 'rotation in attention',
        score: 0.03,
      },
    ];

    expect(toCitationRecords(hits)).toEqual([
      {
        path: 'wiki/concepts/rope.md',
        title: 'RoPE',
        snippet: 'rotation in attention',
      },
    ]);
  });

  it('returns empty array for no hits', () => {
    expect(toCitationRecords([])).toEqual([]);
  });
});
