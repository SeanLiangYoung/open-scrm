import api from '@/utils/api';

/** LLM 合成/生成类接口可能超过默认 15s，单独放宽超时。 */
const LLM_REQUEST_TIMEOUT_MS = 120_000;

export interface KbCitation {
  path: string;
  title: string;
  snippet?: string;
}

export interface ContentSource {
  id: number;
  title: string;
  body?: string | null;
  summary?: string | null;
  keywords?: string[] | null;
  tone?: string | null;
  targetAudience?: string | null;
  kbEnabled?: boolean;
  kbQuery?: string | null;
  kbProjectId?: string | null;
  kbSelectedPaths?: string[];
  kbCitations?: KbCitation[];
  composeStatus?: 'draft' | 'composed' | 'finalized';
  updateTime?: string;
}

export interface ContentVariant {
  id: number;
  channel: string;
  title?: string | null;
  body?: string | null;
  structured?: Record<string, unknown> | null;
}

export interface GenerationResult {
  jobId: number;
  status: string;
  kbMode?: string;
  kbHits?: number;
  variants?: ContentVariant[];
}

export const contentStudioApi = {
  listSources(params?: { page?: number; pageSize?: number }) {
    return api.get('/api/v1/content-studio/sources', { params });
  },

  createSource(payload: Partial<ContentSource>) {
    return api.post('/api/v1/content-studio/sources', payload);
  },

  getSource(id: number) {
    return api.get(`/api/v1/content-studio/sources/${id}`);
  },

  updateSource(id: number, payload: Partial<ContentSource>) {
    return api.patch(`/api/v1/content-studio/sources/${id}`, payload);
  },

  deleteSource(id: number) {
    return api.delete(`/api/v1/content-studio/sources/${id}`);
  },

  kbHealth() {
    return api.get('/api/v1/content-studio/kb/health');
  },

  kbSearch(payload: { query: string; topK?: number; includeContent?: boolean }) {
    return api.post('/api/v1/content-studio/kb/search', payload);
  },

  kbReadPages(payload: { paths: string[]; projectId?: string }) {
    return api.post('/api/v1/content-studio/kb/read-pages', payload);
  },

  composeSource(
    sourceId: number,
    payload?: {
      paths?: string[];
      tone?: string;
      targetAudience?: string;
      instruction?: string;
    }
  ) {
    return api.post(`/api/v1/content-studio/sources/${sourceId}/compose`, payload ?? {}, {
      timeout: LLM_REQUEST_TIMEOUT_MS
    });
  },

  generate(
    sourceId: number,
    payload: { channels: string[]; kbEnabled?: boolean; kbQuery?: string }
  ) {
    return api.post(`/api/v1/content-studio/sources/${sourceId}/generate`, payload, {
      timeout: LLM_REQUEST_TIMEOUT_MS
    });
  },

  getJob(jobId: number) {
    return api.get(`/api/v1/content-studio/jobs/${jobId}`);
  },

  pushDraft(
    variantId: number,
    payload: { platform: string; accountId: number; contentType: number }
  ) {
    return api.post(`/api/v1/content-studio/variants/${variantId}/push-draft`, payload);
  },

  pushDrafts(
    sourceId: number,
    payload: {
      items: Array<{
        variantId: number;
        platform: string;
        accountId: number;
        contentType: number;
      }>;
    }
  ) {
    return api.post(`/api/v1/content-studio/sources/${sourceId}/push-drafts`, payload);
  },

  listPlatformAccounts(params?: { platform?: string }) {
    return api.get('/api/platform-account/list', { params });
  },

  listDrafts(params?: { status?: number; platform?: string }) {
    return api.get('/api/v1/acquisition/contents', { params });
  },

  publishContent(contentId: number) {
    return api.post(`/api/v1/acquisition/contents/${contentId}/publish`);
  },

  batchPublishContents(contentIds: number[]) {
    return api.post('/api/v1/acquisition/contents/batch-publish', { contentIds });
  },

  getPublishStatus(contentId: number) {
    return api.get(`/api/v1/acquisition/contents/${contentId}/publish-status`);
  },

  connectPlatformOAuth(accountId: number, payload: { accessToken: string; refreshToken?: string }) {
    return api.post(`/api/platform-account/${accountId}/oauth`, payload);
  }
};
