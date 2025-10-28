/**
 * 角色枚举
 */
export enum Role {
  /** 超级管理员 */
  SUPER_ADMIN = 'super_admin',
  /** 管理员 */
  ADMIN = 'admin',
  /** 运营人员 */
  OPERATOR = 'operator',
  /** 销售人员 */
  SALES = 'sales',
  /** 查看者 */
  VIEWER = 'viewer'
}

/**
 * 权限类型枚举
 */
export enum PermissionType {
  /** 菜单权限 */
  MENU = 'menu',
  /** 按钮权限 */
  BUTTON = 'button',
  /** API权限 */
  API = 'api'
}

