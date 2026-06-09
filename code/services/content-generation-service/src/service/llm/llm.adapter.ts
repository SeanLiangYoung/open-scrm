export interface LlmCompletionRequest {
  system: string;
  user: string;
}

export interface LlmCompletionResult {
  content: string;
}

export interface LlmAdapter {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}

export type FetchFn = (
  input: string,
  init?: RequestInit
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export class OpenAiCompatibleLlmAdapter implements LlmAdapter {
  constructor(
    private readonly config: {
      apiBase: string;
      apiKey: string;
      model: string;
      /** Omit to use provider/model default (required for some reasoning models). */
      temperature?: number;
    },
    private readonly fetchFn: FetchFn = fetch
  ) {}

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const base = this.config.apiBase.replace(/\/$/, '');
    const url = `${base}/chat/completions`;

    const payload: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
    };
    if (this.config.temperature !== undefined) {
      payload.temperature = this.config.temperature;
    }

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(data.error?.message || `LLM API error (${response.status})`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM API returned empty content');
    }

    return { content };
  }
}
