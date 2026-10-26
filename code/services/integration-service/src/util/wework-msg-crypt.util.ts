import * as crypto from 'crypto';

// WeCom's protocol padding block is 32, independent of AES's 16-byte block.
const BLOCK = 32;

/**
 * 将 EncodingAESKey（43 字符）解码为 32 字节 AES Key（企微文档约定末尾补 `=` 再 Base64）
 */
export function decodeWeworkAesKey(encodingAesKey: string): Buffer {
  const buf = Buffer.from(`${encodingAesKey}=`, 'base64');
  if (buf.length !== 32) {
    throw new Error('Invalid EncodingAESKey: expected 32 bytes after base64 decode');
  }
  return buf;
}

/**
 * PKCS#7 填充（企微协议块大小 32）
 */
export function pkcs7Pad(data: Buffer): Buffer {
  const padLen = BLOCK - (data.length % BLOCK);
  const n = padLen === 0 ? BLOCK : padLen;
  return Buffer.concat([data, Buffer.alloc(n, n)]);
}

export function pkcs7Unpad(data: Buffer): Buffer {
  if (data.length === 0) {
    throw new Error('Invalid PKCS7: empty buffer');
  }
  const pad = data[data.length - 1];
  if (pad < 1 || pad > BLOCK || pad > data.length ||
      !data.subarray(data.length - pad).every(byte => byte === pad)) {
    throw new Error('Invalid PKCS7 padding');
  }
  return data.subarray(0, data.length - pad);
}

/**
 * 企业微信「无密文参与」的 SHA1 签名校验（部分场景 / 单元测试用）。
 * 被动回调 URL 验证与消息体验签请使用 {@link verifyWeworkMsgSignature}。
 */
export function verifyWeworkCallbackSignature(
  token: string,
  timestamp: string,
  nonce: string,
  signature: string
): boolean {
  const plain = [token, timestamp, nonce].sort().join('');
  const sha1 = crypto.createHash('sha1').update(plain).digest('hex');
  return sha1 === signature;
}

/**
 * 企业微信被动回调：msg_signature = SHA1( sort([token, timestamp, nonce, encryptOrEchoStr]).join('') )
 * - GET 验证 URL：`encryptOrEchoStr` 为 query 中的 `echostr`（密文）
 * - POST 接收消息：`encryptOrEchoStr` 为 XML 中 `Encrypt` 节点内容（密文）
 */
export function verifyWeworkMsgSignature(
  token: string,
  timestamp: string,
  nonce: string,
  encryptOrEchoStr: string,
  msgSignature: string
): boolean {
  const plain = [token, timestamp, nonce, encryptOrEchoStr].sort().join('');
  const sha1 = crypto.createHash('sha1').update(plain).digest('hex');
  return sha1 === msgSignature;
}

/**
 * 构造与企微一致的明文包：random(16) + msgLen(4, BE) + msg + receiveId(corpId)，再 PKCS7，再 AES-256-CBC。
 * IV = aesKey 前 16 字节。
 */
export function encryptWeworkMessage(plainText: string, encodingAesKey: string, corpId: string): string {
  const aesKey = decodeWeworkAesKey(encodingAesKey);
  const iv = aesKey.subarray(0, 16);
  const random = crypto.randomBytes(16);
  const msgBuf = Buffer.from(plainText, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(msgBuf.length, 0);
  const corpBuf = Buffer.from(corpId, 'utf8');
  const packed = Buffer.concat([random, lenBuf, msgBuf, corpBuf]);
  const padded = pkcs7Pad(packed);
  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
  return encrypted.toString('base64');
}

/**
 * 解密企微回调 POST 中的 `Encrypt` 字段（Base64 密文）
 */
export function decryptWeworkMessage(encryptedBase64: string, encodingAesKey: string, corpId: string): string {
  const aesKey = decodeWeworkAesKey(encodingAesKey);
  const iv = aesKey.subarray(0, 16);
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const unpadded = pkcs7Unpad(decrypted);
  if (unpadded.length < 20) {
    throw new Error('Decrypted payload too short');
  }
  const msgLen = unpadded.readUInt32BE(16);
  const msgEnd = 20 + msgLen;
  if (msgEnd > unpadded.length) {
    throw new Error('Invalid message length in decrypted payload');
  }
  const msg = unpadded.subarray(20, msgEnd).toString('utf8');
  const tail = unpadded.subarray(msgEnd);
  const expected = Buffer.from(corpId, 'utf8');
  if (!tail.equals(expected)) {
    throw new Error('corpId mismatch after decrypt');
  }
  return msg;
}
