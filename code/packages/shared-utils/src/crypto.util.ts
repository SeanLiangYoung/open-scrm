/**
 * 加密工具函数
 */

/**
 * 生成随机字符串
 * @param length 长度
 */
export function generateRandomString(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成UUID
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Base64编码
 * @param str 字符串
 */
export function base64Encode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str).toString('base64');
  } else {
    return btoa(encodeURIComponent(str));
  }
}

/**
 * Base64解码
 * @param str Base64字符串
 */
export function base64Decode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString('utf-8');
  } else {
    return decodeURIComponent(atob(str));
  }
}

/**
 * MD5哈希 (简单实现，生产环境建议使用crypto-js)
 * @param _str 字符串
 */
export function simpleMD5(_str: string): string {
  // 注意: 这是一个占位实现，实际使用应该引入crypto-js或Node的crypto模块
  return generateRandomString(32);
}

/**
 * 生成签名
 * @param data 数据对象
 * @param secret 密钥
 */
export function generateSignature(data: Record<string, any>, secret: string): string {
  // 1. 排序
  const keys = Object.keys(data).sort();
  
  // 2. 拼接
  const str = keys.map(key => `${key}=${data[key]}`).join('&');
  
  // 3. 加上密钥
  const signStr = str + '&secret=' + secret;
  
  // 4. MD5
  return simpleMD5(signStr);
}

