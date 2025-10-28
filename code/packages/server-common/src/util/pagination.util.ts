/**
 * 分页工具类
 */

import { PAGINATION } from '@scrm/shared-constants';

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number;
  size?: number;
}

/**
 * 计算分页参数
 */
export function calculatePagination(params: PaginationParams) {
  const page = Math.max(1, params.page || PAGINATION.DEFAULT_PAGE);
  const size = Math.min(
    params.size || PAGINATION.DEFAULT_PAGE_SIZE,
    PAGINATION.MAX_PAGE_SIZE
  );
  const skip = (page - 1) * size;

  return {
    page,
    size,
    skip,
    take: size
  };
}

