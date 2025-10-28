/**
 * 客户相关类型定义
 */

import { CustomerStatus, CustomerType, Gender } from '../enums/customer-status.enum';
import { PaginationRequest } from '../api/response';

/**
 * 客户标签
 */
export interface Tag {
  id: number;
  corpId: number;
  tagName: string;
  tagType: number;
  parentId: number;
  sort: number;
  isAuto: boolean;
  createTime: string;
}

/**
 * 客户信息
 */
export interface Customer {
  id: number;
  corpId: number;
  externalUserid: string;
  name?: string;
  avatar?: string;
  type: CustomerType;
  gender?: Gender;
  unionid?: string;
  province?: string;
  city?: string;
  followUserId?: number;
  followUserName?: string;
  addTime?: string;
  channel?: string;
  status: CustomerStatus;
  tags?: Tag[];
  createTime: string;
  updateTime: string;
}

/**
 * 客户查询参数
 */
export interface CustomerQuery extends PaginationRequest {
  channel?: string;
  status?: CustomerStatus;
  followUserId?: number;
  tagIds?: number[];
  startTime?: string;
  endTime?: string;
}

/**
 * 创建客户DTO
 */
export interface CreateCustomerDto {
  corpId: number;
  externalUserid: string;
  name?: string;
  avatar?: string;
  type?: CustomerType;
  gender?: Gender;
  unionid?: string;
  province?: string;
  city?: string;
  followUserId?: number;
  channel?: string;
}

/**
 * 更新客户DTO
 */
export interface UpdateCustomerDto {
  name?: string;
  avatar?: string;
  gender?: Gender;
  province?: string;
  city?: string;
  followUserId?: number;
  status?: CustomerStatus;
}

/**
 * 客户群信息
 */
export interface CustomerGroup {
  id: number;
  corpId: number;
  chatId: string;
  groupName: string;
  ownerId?: number;
  ownerName?: string;
  memberCount: number;
  notice?: string;
  status: number;
  createTime: string;
  updateTime: string;
}

