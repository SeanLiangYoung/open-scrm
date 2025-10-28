/**
 * 用户相关类型定义
 */

import { UserStatus } from '../enums/user-status.enum';

/**
 * 用户信息
 */
export interface User {
  id: number;
  corpId: number;
  username: string;
  realName?: string;
  mobile?: string;
  email?: string;
  avatar?: string;
  weworkUserid?: string;
  status: UserStatus;
  isAdmin: boolean;
  roles?: RoleInfo[];
  lastLoginTime?: string;
  createTime: string;
  updateTime: string;
}

/**
 * 角色信息
 */
export interface RoleInfo {
  id: number;
  roleName: string;
  roleCode: string;
  description?: string;
}

/**
 * 权限信息
 */
export interface Permission {
  id: number;
  permissionName: string;
  permissionCode: string;
  type: 'menu' | 'button' | 'api';
  parentId?: number;
}

/**
 * 登录请求
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * 登录响应
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/**
 * 用户注册请求
 */
export interface RegisterRequest {
  username: string;
  password: string;
  realName?: string;
  mobile?: string;
  email?: string;
  corpId: number;
}

/**
 * 创建用户DTO
 */
export interface CreateUserDto {
  corpId: number;
  username: string;
  password: string;
  realName?: string;
  mobile?: string;
  email?: string;
  weworkUserid?: string;
  roleIds?: number[];
}

/**
 * 更新用户DTO
 */
export interface UpdateUserDto {
  realName?: string;
  mobile?: string;
  email?: string;
  avatar?: string;
  status?: UserStatus;
  roleIds?: number[];
}

