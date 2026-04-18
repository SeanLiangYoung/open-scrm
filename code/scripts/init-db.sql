-- 数据库初始化脚本（MySQL 历史参考；当前开发环境请使用 PostgreSQL + init-db.pg.sql）

-- 设置连接字符集
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

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
VALUES (1, 'admin', '$2b$12$Vr7iDIPkR7e.QsfWs/iyQujwrS/Quwygpzi0zfJIrUOizIKb8jS9W', '系统管理员', 1, 1)
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

-- =============================================
-- 客户管理模块（匹配 customer-service 实体定义）
-- =============================================

CREATE TABLE IF NOT EXISTS `customer` (
  `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `corp_id` BIGINT UNSIGNED NOT NULL,
  `external_userid` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '企微外部联系人ID',
  `name` VARCHAR(100),
  `mobile` VARCHAR(20),
  `avatar` VARCHAR(255),
  `type` TINYINT DEFAULT 1 COMMENT '1-微信 2-企微',
  `gender` TINYINT DEFAULT 0 COMMENT '0-未知 1-男 2-女',
  `unionid` VARCHAR(100),
  `province` VARCHAR(50),
  `city` VARCHAR(50),
  `follow_user_id` BIGINT UNSIGNED COMMENT '跟进员工ID',
  `add_time` DATETIME,
  `channel` VARCHAR(50) COMMENT '添加渠道',
  `status` TINYINT DEFAULT 1 COMMENT '0-已删除 1-正常 2-流失',
  `remark` TEXT,
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_corp_id` (`corp_id`),
  KEY `idx_follow_user_id` (`follow_user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户表';

CREATE TABLE IF NOT EXISTS `customer_tag` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `corp_id` BIGINT UNSIGNED NOT NULL,
  `tag_name` VARCHAR(50) NOT NULL,
  `tag_type` TINYINT DEFAULT 1 COMMENT '1-来源 2-行为 3-兴趣 4-价值',
  `tag_color` VARCHAR(10),
  `parent_id` INT UNSIGNED DEFAULT 0,
  `sort` INT DEFAULT 0,
  `is_auto` TINYINT DEFAULT 0,
  `status` TINYINT DEFAULT 1 COMMENT '0-禁用 1-启用',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_corp_id` (`corp_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户标签表';

CREATE TABLE IF NOT EXISTS `customer_tag_relation` (
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `tag_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`customer_id`, `tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户标签关联表';

-- =============================================
-- SOP 运营模块（匹配 operation-service 实体定义）
-- =============================================

CREATE TABLE IF NOT EXISTS `sop_template` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `corp_id` BIGINT UNSIGNED NOT NULL,
  `template_name` VARCHAR(100) NOT NULL,
  `template_type` TINYINT NOT NULL DEFAULT 1 COMMENT '1-客户SOP 2-群SOP',
  `trigger_type` TINYINT NOT NULL DEFAULT 4 COMMENT '1-添加好友 2-打标签 3-进群 4-手动触发',
  `trigger_condition` JSON,
  `description` TEXT,
  `status` TINYINT DEFAULT 1 COMMENT '0-禁用 1-启用',
  `create_user_id` BIGINT UNSIGNED,
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_corp_id` (`corp_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SOP模板表';

CREATE TABLE IF NOT EXISTS `sop_step` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `template_id` INT UNSIGNED NOT NULL,
  `step_order` INT NOT NULL,
  `step_name` VARCHAR(100) NOT NULL,
  `step_type` TINYINT NOT NULL DEFAULT 1 COMMENT '1-发消息 2-打标签 3-推送素材 4-分配客户 5-提醒员工',
  `delay_time` INT DEFAULT 0,
  `delay_unit` VARCHAR(10) DEFAULT 'minute',
  `action_type` TINYINT,
  `action_content` JSON,
  `status` TINYINT DEFAULT 1,
  KEY `idx_template_id` (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SOP步骤表';

CREATE TABLE IF NOT EXISTS `sop_execution` (
  `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `corp_id` BIGINT UNSIGNED NOT NULL,
  `template_id` INT UNSIGNED NOT NULL,
  `template_name` VARCHAR(100),
  `target_type` TINYINT NOT NULL DEFAULT 1 COMMENT '1-客户 2-群',
  `customer_id` BIGINT UNSIGNED,
  `group_id` BIGINT UNSIGNED,
  `current_step` INT DEFAULT 0,
  `total_steps` INT DEFAULT 0,
  `status` TINYINT DEFAULT 0 COMMENT '0-执行中 1-已完成 2-已暂停 3-已失败',
  `start_time` DATETIME,
  `complete_time` DATETIME,
  `error_message` VARCHAR(500),
  `execution_log` JSON,
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_template_id` (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SOP执行记录表';

CREATE TABLE IF NOT EXISTS `mass_task` (
  `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `corp_id` BIGINT UNSIGNED NOT NULL,
  `task_name` VARCHAR(100) NOT NULL,
  `task_type` TINYINT NOT NULL DEFAULT 1 COMMENT '1-群发消息 2-批量打标签 3-批量分配',
  `target_type` TINYINT NOT NULL DEFAULT 1 COMMENT '1-客户 2-员工 3-群',
  `target_ids` JSON,
  `target_count` INT DEFAULT 0,
  `message_content` TEXT,
  `message_type` TINYINT,
  `action_data` JSON,
  `scheduled_time` DATETIME,
  `status` TINYINT DEFAULT 0 COMMENT '0-待执行 1-执行中 2-已完成 3-已失败 4-已取消',
  `success_count` INT DEFAULT 0,
  `fail_count` INT DEFAULT 0,
  `start_time` DATETIME,
  `complete_time` DATETIME,
  `error_message` VARCHAR(500),
  `create_user_id` BIGINT UNSIGNED,
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_corp_id` (`corp_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='群发任务表';

-- =============================================
-- 获客模块
-- =============================================

-- 渠道活码表
CREATE TABLE IF NOT EXISTS `channel_code` (
  `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `corp_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL COMMENT '活码名称',
  `channel` VARCHAR(50) COMMENT '渠道: douyin/xiaohongshu/wechat/offline',
  `qrcode_url` VARCHAR(255) COMMENT '二维码URL',
  `scan_count` INT DEFAULT 0 COMMENT '扫码次数',
  `add_count` INT DEFAULT 0 COMMENT '添加次数',
  `status` TINYINT DEFAULT 1 COMMENT '状态: 0-禁用 1-启用',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_corp_id` (`corp_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='渠道活码表';

-- 平台账号表
CREATE TABLE IF NOT EXISTS `platform_account` (
  `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `corp_id` BIGINT UNSIGNED NOT NULL,
  `platform` VARCHAR(30) NOT NULL COMMENT '平台: douyin/xiaohongshu/wechat',
  `account_name` VARCHAR(100) NOT NULL COMMENT '账号名称',
  `account_id` VARCHAR(100) COMMENT '平台账号ID',
  `access_token` VARCHAR(500) COMMENT 'OAuth token',
  `token_expires_at` DATETIME COMMENT 'token过期时间',
  `status` TINYINT DEFAULT 1 COMMENT '状态: 0-失效 1-正常',
  `follower_count` INT DEFAULT 0,
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_corp_id` (`corp_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台账号表';

-- =============================================
-- 种子数据
-- =============================================

-- 示例客户
INSERT INTO `customer` (`corp_id`, `external_userid`, `name`, `gender`, `mobile`, `channel`, `status`, `follow_user_id`) VALUES
(1, 'ext_001', '张三', 1, '13800001001', 'douyin', 1, 1),
(1, 'ext_002', '李四', 2, '13800001002', 'xiaohongshu', 1, 1),
(1, 'ext_003', '王五', 1, '13800001003', 'wechat', 1, 1),
(1, 'ext_004', '赵六', 2, '13800001004', 'douyin', 1, 1),
(1, 'ext_005', '钱七', 1, '13800001005', 'offline', 2, 1),
(1, 'ext_006', '孙八', 2, '13800001006', 'xiaohongshu', 1, 1),
(1, 'ext_007', '周九', 1, '13800001007', 'wechat', 1, 1),
(1, 'ext_008', '吴十', 2, '13800001008', 'douyin', 0, 1)
ON DUPLICATE KEY UPDATE `name` = `name`;

-- 示例标签
INSERT INTO `customer_tag` (`corp_id`, `tag_name`, `tag_type`, `tag_color`, `status`) VALUES
(1, '高意向', 4, '#67C23A', 1),
(1, '中意向', 4, '#E6A23C', 1),
(1, '低意向', 4, '#F56C6C', 1),
(1, '抖音来源', 1, '#409EFF', 1),
(1, '小红书来源', 1, '#E6A23C', 1),
(1, 'VIP客户', 4, '#F56C6C', 1),
(1, '新客户', 2, '#909399', 1),
(1, '已转化', 2, '#67C23A', 1)
ON DUPLICATE KEY UPDATE `tag_name` = `tag_name`;

-- 示例SOP模板
INSERT INTO `sop_template` (`corp_id`, `template_name`, `template_type`, `trigger_type`, `description`, `status`, `create_user_id`) VALUES
(1, '新客欢迎SOP', 1, 1, '新客户添加后自动发送欢迎消息并打标签', 1, 1),
(1, '7天跟进SOP', 1, 4, '客户添加7天后未转化的跟进流程', 1, 1),
(1, '社群运营SOP', 2, 3, '新群成员入群欢迎+引导流程', 0, 1)
ON DUPLICATE KEY UPDATE `template_name` = `template_name`;

-- SOP步骤
INSERT INTO `sop_step` (`template_id`, `step_order`, `step_name`, `step_type`, `delay_time`, `delay_unit`, `action_type`, `action_content`) VALUES
(1, 1, '发送欢迎消息', 1, 0, 'minute', 1, '{"text": "您好！欢迎关注我们"}'),
(1, 2, '打标签', 2, 5, 'minute', 2, '{"tagName": "新客户"}'),
(1, 3, '发送产品介绍', 1, 60, 'minute', 1, '{"text": "这是我们的产品介绍"}'),
(2, 1, '发送跟进消息', 1, 0, 'minute', 1, '{"text": "您好，最近有什么可以帮到您的吗？"}'),
(2, 2, '发送优惠信息', 1, 1440, 'minute', 1, '{"text": "我们近期有特别优惠活动"}')
ON DUPLICATE KEY UPDATE `step_name` = `step_name`;

