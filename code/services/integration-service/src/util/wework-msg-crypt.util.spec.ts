import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import {
  verifyWeworkCallbackSignature,
  verifyWeworkMsgSignature,
  encryptWeworkMessage,
  decryptWeworkMessage,
  decodeWeworkAesKey,
  pkcs7Pad,
  pkcs7Unpad,
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

describe('verifyWeworkMsgSignature', () => {
  it('matches WeCom formula: sha1(sort([token,timestamp,nonce,echostr]))', () => {
    const token = 'scrm_s2_callback_token';
    const timestamp = '1714281600';
    const nonce = 'nonce123';
    const encodingAesKey = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
    const corpId = 'wx1234567890abcdef';
    const plainEcho = 'url_verify_ok';
    const echostr = encryptWeworkMessage(plainEcho, encodingAesKey, corpId);
    const arr = [token, timestamp, nonce, echostr].sort();
    const msgSignature = crypto.createHash('sha1').update(arr.join('')).digest('hex');
    expect(verifyWeworkMsgSignature(token, timestamp, nonce, echostr, msgSignature)).toBe(true);
    expect(verifyWeworkMsgSignature(token, timestamp, nonce, echostr, 'bad')).toBe(false);
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

describe('WeCom protocol padding compatibility', () => {
  it('decodes an independent 32-byte-padding fixture with a 20-byte suffix', () => {
    // Tencent reference format: fixed random prefix 0123456789abcdef,
    // uint32 length, <xml/>, corp ID, then twenty bytes of value 20.
    const ciphertext = 'Q3stYC6hdFzMh9T8HCvyDBi+USosE2Gv611az/Jxrha7Sqa470+R5XvbkAEPqL9WhPmzJzfMLenZEUWM5fUQWQ==';
    expect(decryptWeworkMessage(ciphertext, 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG', 'wx1234567890abcdef'))
      .toBe('<xml/>');
  });

  it('pads an already 32-byte payload with a full protocol block', () => {
    const padded = pkcs7Pad(Buffer.alloc(32, 1));
    expect(padded.length).toBe(64);
    expect(padded.subarray(32)).toEqual(Buffer.alloc(32, 32));
  });

  it('rejects inconsistent padding bytes instead of just trusting the last byte', () => {
    const padded = Buffer.alloc(32, 4);
    padded[30] = 5;
    expect(() => pkcs7Unpad(padded)).toThrow(/padding/);
  });
});
