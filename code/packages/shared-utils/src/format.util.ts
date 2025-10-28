/**
 * 格式化工具函数
 */

/**
 * 格式化金额
 * @param amount 金额
 * @param decimals 小数位数
 * @returns 格式化后的金额
 */
export function formatMoney(amount: number, decimals = 2): string {
  return amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化手机号
 * @param mobile 手机号
 * @returns 格式化后的手机号 (138****8888)
 */
export function formatMobile(mobile: string): string {
  if (!mobile || mobile.length !== 11) return mobile;
  return mobile.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

/**
 * 格式化身份证号
 * @param idCard 身份证号
 * @returns 格式化后的身份证号
 */
export function formatIdCard(idCard: string): string {
  if (!idCard) return idCard;
  return idCard.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2');
}

/**
 * 格式化银行卡号
 * @param cardNo 银行卡号
 * @returns 格式化后的银行卡号
 */
export function formatBankCard(cardNo: string): string {
  if (!cardNo) return cardNo;
  return cardNo.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
}

/**
 * 千分位格式化
 * @param num 数字
 */
export function formatThousand(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 格式化百分比
 * @param value 值
 * @param total 总数
 * @param decimals 小数位数
 */
export function formatPercentage(value: number, total: number, decimals = 2): string {
  if (total === 0) return '0%';
  return ((value / total) * 100).toFixed(decimals) + '%';
}

/**
 * 首字母大写
 * @param str 字符串
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * 驼峰转下划线
 * @param str 字符串
 */
export function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/**
 * 下划线转驼峰
 * @param str 字符串
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

