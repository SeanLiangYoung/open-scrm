import { describe, it, expect } from 'vitest';
import { normalizeIdempotencyKey, resolveIdempotentReplay } from './message-idempotency.util';

describe('normalizeIdempotencyKey', () => {
  it('returns null for undefined, empty or whitespace-only', () => {
    expect(normalizeIdempotencyKey(undefined)).toBeNull();
    expect(normalizeIdempotencyKey('')).toBeNull();
    expect(normalizeIdempotencyKey('   ')).toBeNull();
  });

  it('trims and accepts 1..128 chars', () => {
    expect(normalizeIdempotencyKey('  sprint3-key  ')).toBe('sprint3-key');
    expect(normalizeIdempotencyKey('a'.repeat(128))).toBe('a'.repeat(128));
  });

  it('returns null when longer than 128', () => {
    expect(normalizeIdempotencyKey('b'.repeat(129))).toBeNull();
  });
});

describe('resolveIdempotentReplay', () => {
  it('returns null when key is null', () => {
    expect(resolveIdempotentReplay(1, null, null)).toBeNull();
  });

  it('returns null when key set but no existing row', () => {
    expect(resolveIdempotentReplay(1, 'idem-1', null)).toBeNull();
  });

  it('returns null when existing row belongs to another corp', () => {
    const existing = {
      id: 9,
      corpId: 2,
      sendStatus: 1,
      content: 'x',
      failReason: null as string | null,
      externalId: null as string | null,
    };
    expect(resolveIdempotentReplay(1, 'idem-1', existing)).toBeNull();
  });

  it('returns replay for successful prior send', () => {
    const existing = {
      id: 10,
      corpId: 1,
      sendStatus: 1,
      content: 'hello',
      failReason: null,
      externalId: 'ext-1',
    };
    expect(resolveIdempotentReplay(1, 'idem-1', existing)).toEqual({
      kind: 'replay',
      messageLogId: 10,
      sendStatus: 1,
      content: 'hello',
      failReason: null,
      externalId: 'ext-1',
    });
  });

  it('returns replay for failed prior send without re-executing send', () => {
    const existing = {
      id: 11,
      corpId: 1,
      sendStatus: 2,
      content: 'fail-body',
      failReason: 'timeout',
      externalId: null,
    };
    expect(resolveIdempotentReplay(1, 'idem-2', existing)).toEqual({
      kind: 'replay',
      messageLogId: 11,
      sendStatus: 2,
      content: 'fail-body',
      failReason: 'timeout',
      externalId: null,
    });
  });

  it('returns replay for in-flight prior send', () => {
    const existing = {
      id: 12,
      corpId: 1,
      sendStatus: 0,
      content: 'pending',
      failReason: null,
      externalId: null,
    };
    expect(resolveIdempotentReplay(1, 'idem-3', existing)).toEqual({
      kind: 'replay',
      messageLogId: 12,
      sendStatus: 0,
      content: 'pending',
      failReason: null,
      externalId: null,
    });
  });
});

describe('PostgreSQL bigint tenant identity replay', () => {
  const existing = (corpId: number | string) => ({ id: 99, corpId, sendStatus: 1, content: 'original', failReason: null, externalId: null });
  it('accepts string-hydrated enterprise identity matching a trusted safe numeric identity', () => {
    expect(resolveIdempotentReplay(1, 'key', existing('1'))).toMatchObject({ kind: 'replay', messageLogId: 99, content: 'original' });
  });
  it('preserves exact large decimal enterprise identities without Number rounding', () => {
    expect(resolveIdempotentReplay('9223372036854775807', 'key', existing('9223372036854775807'))).toMatchObject({ kind: 'replay' });
    expect(resolveIdempotentReplay('9007199254740992', 'key', existing('9007199254740993'))).toBeNull();
    expect(resolveIdempotentReplay(1, 'key', existing('2'))).toBeNull();
  });
  it.each(['01', ' 1', '1 ', '+1', '1.0', '1e0', '', '0', '-1', Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])('rejects ambiguous or unsafe enterprise identity %s', identity => {
    expect(resolveIdempotentReplay(identity, 'key', existing(identity))).toBeNull();
    expect(resolveIdempotentReplay(1, 'key', existing(identity))).toBeNull();
  });
});
