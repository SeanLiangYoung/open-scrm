export interface VariantDraftInput {
  channel: string;
  title?: string | null;
  body?: string | null;
  structured?: Record<string, unknown> | null;
}

export interface MapVariantToContentDraftInput {
  corpId: number;
  accountId: number;
  platform: string;
  contentType: number;
  createUserId?: number;
  variant: VariantDraftInput;
}

export interface ContentDraftPayload {
  corpId: number;
  accountId: number;
  platform: string;
  contentType: number;
  title: string | null;
  content: string | null;
  topics: string[] | null;
  status: number;
  createUserId?: number;
}

export function mapVariantToContentDraft(
  input: MapVariantToContentDraftInput
): ContentDraftPayload {
  const tags = input.variant.structured?.tags;
  const topics = Array.isArray(tags)
    ? tags.filter((tag): tag is string => typeof tag === 'string')
    : null;

  return {
    corpId: input.corpId,
    accountId: input.accountId,
    platform: input.platform,
    contentType: input.contentType,
    title: input.variant.title ?? null,
    content: input.variant.body ?? null,
    topics,
    status: 0,
    ...(input.createUserId !== undefined ? { createUserId: input.createUserId } : {}),
  };
}
