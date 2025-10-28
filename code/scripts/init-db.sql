-- 数据库初始化脚本

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `scrm_dev` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `scrm_dev`;

-- 用户表
CREATE TABLE IF NOT EXISTS `user` (
  `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
  `corp_id` BIGINT UNSIGNED NOT NULL COMMENT '企业ID',
  `username` VARCHAR(50) NOT NULL COMMENT '用户名',
  `password` VARCHAR(255) NOT NULL COMMENT '密码',
  `real_name` VARCHAR(50) COMMENT '真实姓名',
  `mobile` VARCHAR(20) COMMENT '手机号',
  `email` VARCHAR(100) COMMENT '邮箱',
  `avatar` VARCHAR(255) COMMENT '头像',
  `wework_userid` VARCHAR(64) COMMENT '企微用户ID',
  `status` TINYINT DEFAULT 1 COMMENT '状态: 0-禁用 1-正常',
  `is_admin` TINYINT DEFAULT 0 COMMENT '是否管理员: 0-否 1-是',
  `last_login_time` DATETIME COMMENT '最后登录时间',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `uk_username` (`corp_id`, `username`),
  KEY `idx_mobile` (`mobile`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 角色表
CREATE TABLE IF NOT EXISTS `role` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '角色ID',
  `corp_id` BIGINT UNSIGNED NOT NULL COMMENT '企业ID',
  `role_name` VARCHAR(50) NOT NULL COMMENT '角色名称',
  `role_code` VARCHAR(50) NOT NULL COMMENT '角色代码',
  `description` VARCHAR(255) COMMENT '描述',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY `uk_role_code` (`corp_id`, `role_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- 用户角色关联表
CREATE TABLE IF NOT EXISTS `user_role` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `role_id` INT UNSIGNED NOT NULL COMMENT '角色ID',
  PRIMARY KEY (`user_id`, `role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户角色关联表';

-- 权限表
CREATE TABLE IF NOT EXISTS `permission` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '权限ID',
  `permission_name` VARCHAR(50) NOT NULL COMMENT '权限名称',
  `permission_code` VARCHAR(50) NOT NULL COMMENT '权限代码',
  `type` VARCHAR(20) NOT NULL COMMENT '权限类型: menu/button/api',
  `parent_id` INT UNSIGNED DEFAULT 0 COMMENT '父权限ID',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY `uk_permission_code` (`permission_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表';

-- 角色权限关联表
CREATE TABLE IF NOT EXISTS `role_permission` (
  `role_id` INT UNSIGNED NOT NULL COMMENT '角色ID',
  `permission_id` INT UNSIGNED NOT NULL COMMENT '权限ID',
  PRIMARY KEY (`role_id`, `permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色权限关联表';

-- 插入默认管理员用户 (密码: Admin@123)
INSERT INTO `user` (`corp_id`, `username`, `password`, `real_name`, `is_admin`, `status`) 
VALUES (1, 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lxlexRJZgP.u', '系统管理员', 1, 1)
ON DUPLICATE KEY UPDATE `username` = `username`;

-- 插入默认角色
INSERT INTO `role` (`corp_id`, `role_name`, `role_code`, `description`) 
VALUES 
  (1, '超级管理员', 'super_admin', '拥有所有权限'),
  (1, '管理员', 'admin', '管理企业和用户'),
  (1, '运营人员', 'operator', '运营客户和SOP'),
  (1, '销售人员', 'sales', '管理客户和跟进'),
  (1, '查看者', 'viewer', '只能查看数据')
ON DUPLICATE KEY UPDATE `role_name` = `role_name`;

