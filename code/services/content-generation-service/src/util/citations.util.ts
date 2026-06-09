import type { LlmWikiSearchResult } from '@scrm/llm-wiki-client';

export interface CitationRecord {
  path: string;
  title: string;
  snippet: string;
}

export function toCitationRecords(
  results: LlmWikiSearchResult[]
): CitationRecord[] {
  return results.map(result => ({
    path: result.path,
    title: result.title,
    snippet: result.snippet,
  }));
}
