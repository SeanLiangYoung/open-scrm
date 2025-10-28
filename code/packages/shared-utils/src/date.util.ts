/**
 * 日期时间工具函数
 */

import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';

// 扩展dayjs插件
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

/**
 * 格式化日期时间
 * @param date 日期
 * @param format 格式
 * @returns 格式化后的字符串
 */
export function formatDate(date: string | Date | number, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(date).format(format);
}

/**
 * 格式化为日期
 * @param date 日期
 * @returns YYYY-MM-DD
 */
export function formatDateOnly(date: string | Date | number): string {
  return dayjs(date).format('YYYY-MM-DD');
}

/**
 * 格式化为时间
 * @param date 日期
 * @returns HH:mm:ss
 */
export function formatTimeOnly(date: string | Date | number): string {
  return dayjs(date).format('HH:mm:ss');
}

/**
 * 相对时间
 * @param date 日期
 * @returns 相对时间描述
 */
export function formatRelativeTime(date: string | Date | number): string {
  return dayjs(date).fromNow();
}

/**
 * 获取当前时间戳（秒）
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 获取当前时间戳（毫秒）
 */
export function getCurrentTimestampMs(): number {
  return Date.now();
}

/**
 * 判断是否为今天
 * @param date 日期
 */
export function isToday(date: string | Date | number): boolean {
  return dayjs(date).isSame(dayjs(), 'day');
}

/**
 * 判断是否为本周
 * @param date 日期
 */
export function isThisWeek(date: string | Date | number): boolean {
  return dayjs(date).isSame(dayjs(), 'week');
}

/**
 * 判断是否为本月
 * @param date 日期
 */
export function isThisMonth(date: string | Date | number): boolean {
  return dayjs(date).isSame(dayjs(), 'month');
}

/**
 * 获取日期范围
 * @param type 类型: today, week, month, year
 */
export function getDateRange(type: 'today' | 'week' | 'month' | 'year'): {
  startDate: string;
  endDate: string;
} {
  const now = dayjs();
  let startDate: dayjs.Dayjs;
  let endDate: dayjs.Dayjs;

  switch (type) {
    case 'today':
      startDate = now.startOf('day');
      endDate = now.endOf('day');
      break;
    case 'week':
      startDate = now.startOf('week');
      endDate = now.endOf('week');
      break;
    case 'month':
      startDate = now.startOf('month');
      endDate = now.endOf('month');
      break;
    case 'year':
      startDate = now.startOf('year');
      endDate = now.endOf('year');
      break;
  }

  return {
    startDate: startDate.format('YYYY-MM-DD HH:mm:ss'),
    endDate: endDate.format('YYYY-MM-DD HH:mm:ss')
  };
}

/**
 * 计算两个日期之间的天数
 * @param date1 日期1
 * @param date2 日期2
 */
export function daysBetween(date1: string | Date | number, date2: string | Date | number): number {
  return dayjs(date2).diff(dayjs(date1), 'day');
}

