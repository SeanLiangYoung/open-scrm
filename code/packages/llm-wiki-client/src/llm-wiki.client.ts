export interface LlmWikiClientConfig {
  baseUrl: string;
  token?: string;
  projectId?: string;
}

export interface LlmWikiHealthResponse {
  ok: boolean;
  status: string;
  version?: string;
  enabled?: boolean;
  authRequired?: boolean;
  authConfigured?: boolean;
}

export interface LlmWikiSearchResult {
  path: string;
  title: string;
  snippet: string;
  score?: number;
  vectorScore?: number;
  content?: string | null;
}

export interface LlmWikiSearchResponse {
  ok: boolean;
  mode?: 'keyword' | 'vector' | 'hybrid' | 'off';
  tokenHits?: number;
  vectorHits?: number;
  results: LlmWikiSearchResult[];
  error?: string;
}

export interface LlmWikiPageContent {
  ok: boolean;
  path: string;
  content: string;
}

export interface LlmWikiProject {
  id: string;
  name: string;
  path: string;
  current: boolean;
}

export interface LlmWikiSearchOptions {
  topK?: number;
  includeContent?: boolean;
}

export type FetchFn = (
  input: string,
  init?: RequestInit
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export class LlmWikiClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly projectId: string;
  private readonly fetchFn: FetchFn;

  constructor(config: LlmWikiClientConfig, fetchFn: FetchFn = fetch) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
    this.projectId = config.projectId || 'current';
    this.fetchFn = fetchFn;
  }

  async health(): Promise<LlmWikiHealthResponse> {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/health`, {
      method: 'GET',
      headers: {},
    });
    return (await response.json()) as LlmWikiHealthResponse;
  }

  async listProjects(): Promise<LlmWikiProject[]> {
    const data = await this.request<{ projects: LlmWikiProject[] }>(
      `${this.baseUrl}/api/v1/projects`,
      { method: 'GET' }
    );
    return data.projects;
  }

  async search(
    query: string,
    options: LlmWikiSearchOptions = {}
  ): Promise<LlmWikiSearchResponse> {
    const topK = options.topK ?? 10;
    const includeContent = options.includeContent ?? false;

    return this.request<LlmWikiSearchResponse>(
      `${this.baseUrl}/api/v1/projects/${encodeURIComponent(this.projectId)}/search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topK, includeContent }),
      }
    );
  }

  async readPage(path: string): Promise<LlmWikiPageContent> {
    const url = `${this.baseUrl}/api/v1/projects/${encodeURIComponent(this.projectId)}/files/content?path=${encodeURIComponent(path)}`;
    return this.request<LlmWikiPageContent>(url, { method: 'GET' });
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request<T>(
    url: string,
    init: RequestInit
  ): Promise<T> {
    const response = await this.fetchFn(url, {
      ...init,
      headers: this.authHeaders(
        (init.headers as Record<string, string> | undefined) ?? {}
      ),
    });

    const data = (await response.json()) as T & { ok?: boolean; error?: string };

    if (!response.ok || data.ok === false) {
      const message =
        (data as { error?: string }).error ||
        `LLM Wiki API error (${response.status})`;
      throw new Error(message);
    }

    return data;
  }
}
