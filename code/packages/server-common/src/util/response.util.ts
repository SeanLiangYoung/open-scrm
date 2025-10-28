/**
 * 响应工具类
 */

import { ApiResponse } from '@scrm/shared-types';

/**
 * 成功响应
 */
export function success<T>(data: T, message = 'success'): ApiResponse<T> {
  return {
    code: 200,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * 失败响应
 */
export function fail(code: number, message: string): ApiResponse<null> {
  return {
    code,
    message,
    data: null,
    timestamp: new Date().toISOString()
  };
}

/**
 * 分页响应
 */
export function paginate<T>(
  list: T[],
  total: number,
  page: number,
  size: number
): ApiResponse<any> {
  return success({
    list,
    total,
    page,
    size,
    totalPages: Math.ceil(total / size)
  });
}

