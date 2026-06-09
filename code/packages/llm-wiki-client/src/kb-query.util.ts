export interface BuildKbSearchQueryInput {
  title?: string;
  keywords?: string[];
  kbQuery?: string | null;
}

export function buildKbSearchQuery(input: BuildKbSearchQueryInput): string {
  if (input.kbQuery?.trim()) {
    return input.kbQuery.trim();
  }

  const parts: string[] = [];
  if (input.title?.trim()) {
    parts.push(input.title.trim());
  }
  if (input.keywords?.length) {
    parts.push(...input.keywords.map(k => k.trim()).filter(Boolean));
  }

  return parts.join(' ');
}
