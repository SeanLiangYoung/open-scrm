export const MAX_COMPOSE_PAGES = 5;
export const MAX_PAGE_CONTENT_CHARS = 12000;

export function extractPageTitle(path: string, content: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  if (heading?.[1]?.trim()) {
    return heading[1].trim();
  }
  const basename = path.split('/').pop();
  return basename?.replace(/\.md$/i, '') || path;
}

export function truncatePageContent(content: string, maxChars = MAX_PAGE_CONTENT_CHARS): string {
  if (content.length <= maxChars) {
    return content;
  }
  return `${content.slice(0, maxChars)}\n\n...[truncated]`;
}

export function parseCoreComposePayload(raw: string): {
  title: string;
  summary: string;
  body: string;
  keywords: string[];
} {
  const trimmed = raw.trim();
  const jsonText = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    : trimmed;

  const parsed = JSON.parse(jsonText) as {
    title?: string;
    summary?: string;
    body?: string;
    keywords?: unknown;
  };

  if (!parsed.title?.trim() || !parsed.body?.trim()) {
    throw new Error('LLM compose response missing title or body');
  }

  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    : [];

  return {
    title: parsed.title.trim(),
    summary: (parsed.summary ?? '').trim(),
    body: parsed.body.trim(),
    keywords,
  };
}
