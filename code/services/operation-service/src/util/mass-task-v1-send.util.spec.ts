import { describe, it, expect } from 'vitest';
import {
  buildMessageServiceV1SendUrl,
  buildMassTaskIdempotencyKey,
  normalizeMassTaskTextContent,
} from './mass-task-v1-send.util';

describe('mass-task-v1-send.util', () => {
  it('buildMessageServiceV1SendUrl trims slash', () => {
    expect(buildMessageServiceV1SendUrl('http://localhost:7008/')).toBe(
      'http://localhost:7008/api/v1/messages/send'
    );
  });

  it('buildMassTaskIdempotencyKey is stable per task and target', () => {
    expect(buildMassTaskIdempotencyKey(42, 7)).toBe('mass-task-42-tgt-7');
  });

  it('normalizeMassTaskTextContent parses JSON text wrapper', () => {
    expect(normalizeMassTaskTextContent('{"text":"hello"}')).toBe('hello');
  });

  it('normalizeMassTaskTextContent returns plain string', () => {
    expect(normalizeMassTaskTextContent(' plain ')).toBe('plain');
  });
});
