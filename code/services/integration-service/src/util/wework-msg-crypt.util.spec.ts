import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import {
  verifyWeworkCallbackSignature,
  encryptWeworkMessage,
  decryptWeworkMessage,
  decodeWeworkAesKey,
} from './wework-msg-crypt.util';

describe('verifyWeworkCallbackSignature', () => {
  it('returns true when signature matches SHA1 of sorted token,timestamp,nonce', () => {
    const token = 'QDG6eK';
    const timestamp = '1409659589';
    const nonce = '1372623149';
    const plain = [token, timestamp, nonce].sort().join('');
    const signature = crypto.createHash('sha1').update(plain).digest('hex');
    expect(verifyWeworkCallbackSignature(token, timestamp, nonce, signature)).toBe(true);
  });

  it('returns false when signature does not match', () => {
    expect(verifyWeworkCallbackSignature('a', '1', '2', 'deadbeef')).toBe(false);
  });
});

describe('encryptWeworkMessage / decryptWeworkMessage', () => {
  const encodingAesKey = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
  const corpId = 'wx1234567890abcdef';

  it('round-trips XML message', () => {
    const xml = '<xml><Content><![CDATA[hello]]></Content></xml>';
    const enc = encryptWeworkMessage(xml, encodingAesKey, corpId);
    const dec = decryptWeworkMessage(enc, encodingAesKey, corpId);
    expect(dec).toBe(xml);
  });

  it('rejects wrong corpId', () => {
    const enc = encryptWeworkMessage('<xml/>', encodingAesKey, corpId);
    expect(() => decryptWeworkMessage(enc, encodingAesKey, 'wrong-corp')).toThrow(/corpId mismatch/);
  });
});

describe('decodeWeworkAesKey', () => {
  it('throws on invalid key length', () => {
    expect(() => decodeWeworkAesKey('short')).toThrow(/Invalid EncodingAESKey/);
  });
});
