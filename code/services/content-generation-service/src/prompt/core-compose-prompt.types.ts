export interface CoreComposePageInput {
  path: string;
  title: string;
  content: string;
}

export interface CoreComposeOptions {
  tone?: string;
  targetAudience?: string;
  instruction?: string;
}

export interface CoreComposePrompt {
  system: string;
  user: string;
}

export interface CoreComposeLlmResult {
  title: string;
  summary: string;
  body: string;
  keywords: string[];
}
