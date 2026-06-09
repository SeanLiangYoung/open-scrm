export interface AiCheckInput {
  title?: string | null;
  body?: string | null;
}

export interface AiCheckResult {
  passed: boolean;
  issues: string[];
}

const PLACEHOLDER_PATTERN = /\b(todo|placeholder|lorem ipsum|待补充|请填写)\b/i;
const MIN_BODY_LENGTH = 10;

export function runAiCheck(input: AiCheckInput): AiCheckResult {
  const issues: string[] = [];
  const title = input.title?.trim() ?? '';
  const body = input.body?.trim() ?? '';

  if (!body || body.length < MIN_BODY_LENGTH) {
    issues.push('body_too_short');
  }

  if (title && PLACEHOLDER_PATTERN.test(title)) {
    issues.push('placeholder_in_title');
  }

  if (body && PLACEHOLDER_PATTERN.test(body)) {
    issues.push('placeholder_in_body');
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
