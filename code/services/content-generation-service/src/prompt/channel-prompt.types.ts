export interface PromptSourceContext {
  title: string;
  body?: string | null;
  summary?: string | null;
  keywords?: string[] | null;
  tone?: string | null;
  targetAudience?: string | null;
  kbContext?: string;
}

export interface ChannelPrompt {
  system: string;
  user: string;
}
