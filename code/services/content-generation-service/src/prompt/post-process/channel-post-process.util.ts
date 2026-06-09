import type { ContentChannel } from '@scrm/shared-constants';

export interface PostProcessPayload {
  title?: string | null;
  body?: string | null;
  structured?: Record<string, unknown> | null;
}

const XHS_TITLE_MAX = 20;

export function applyChannelPostProcess(
  channel: ContentChannel,
  payload: PostProcessPayload
): PostProcessPayload {
  if (channel === 'xhs_graphic' && payload.title) {
    const trimmed = payload.title.trim();
    if (trimmed.length > XHS_TITLE_MAX) {
      const candidate = trimmed.slice(0, XHS_TITLE_MAX);
      return {
        ...payload,
        title: candidate,
        structured: {
          ...(payload.structured ?? {}),
          titleCandidates: [candidate],
        },
      };
    }
  }

  if (channel === 'short_video_script') {
    const structured = { ...(payload.structured ?? {}) };
    if (!structured.hook && payload.body) {
      structured.hook = payload.body.trim().slice(0, 40);
    }
    return { ...payload, structured };
  }

  return payload;
}
