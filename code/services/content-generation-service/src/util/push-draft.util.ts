export interface PushDraftOptions {
  platform: string;
  accountId: number;
  contentType: number;
}

export interface VariantDraftSource {
  title?: string | null;
  body?: string | null;
  structured?: Record<string, unknown> | null;
}

export interface CreateContentPayload {
  accountId: number;
  platform: string;
  contentType: number;
  title?: string;
  content?: string;
  topics?: string[];
}

export function buildCreateContentDtoFromVariant(
  variant: VariantDraftSource,
  options: PushDraftOptions
): CreateContentPayload {
  const tags = variant.structured?.tags;
  const topics = Array.isArray(tags)
    ? tags.filter((tag): tag is string => typeof tag === 'string')
    : undefined;

  return {
    accountId: options.accountId,
    platform: options.platform,
    contentType: options.contentType,
    ...(variant.title ? { title: variant.title } : {}),
    ...(variant.body ? { content: variant.body } : {}),
    ...(topics?.length ? { topics } : {}),
  };
}
