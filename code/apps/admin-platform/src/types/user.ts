/** Fields consumed by user and role management after API envelope unwrapping. */
export interface RoleInfo {
  id: number;
  roleName?: string;
  roleCode?: string;
  role_name?: string;
  role_code?: string;
  description?: string | null;
  createTime?: string;
  create_time?: string;
}

export interface UserInfo {
  id: number | string;
  username: string;
  realName?: string | null;
  mobile?: string | null;
  email?: string | null;
  status: number;
  isAdmin: number;
  roles?: RoleInfo[];
}

export interface UserList {
  items: UserInfo[];
  total: number;
}
