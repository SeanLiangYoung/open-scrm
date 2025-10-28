/**
 * API响应类型定义
 */

/**
 * 统一API响应格式
 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

/**
 * 分页响应
 */
export interface PaginationResponse<T> {
  list: T[];
  total: number;
  page: number;
  size: number;
}

/**
 * 分页请求参数
 */
export interface PaginationRequest {
  page?: number;
  size?: number;
  keyword?: string;
}

/**
 * 成功响应
 */
export interface SuccessResponse {
  code: 200;
  message: string;
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  code: number;
  message: string;
  error?: string;
  details?: any;
}

