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
-- 客户管理模块
-- =============================================

-- 客户表
CREATE TABLE IF NOT EXISTS `customer` (
  `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `corp_id` BIGINT UNSIGNED NOT NULL COMMENT '企业ID',
  `name` VARCHAR(100) NOT NULL COMMENT '客户名称',
  `avatar` VARCHAR(255) COMMENT '头像URL',
  `gender` TINYINT DEFAULT 0 COMMENT '性别: 0-未知 1-男 2-女',
  `mobile` VARCHAR(20) COMMENT '手机号',
  `email` VARCHAR(100) COMMENT '邮箱',
  `wework_external_userid` VARCHAR(64) COMMENT '企微外部联系人ID',
  `source` VARCHAR(50) COMMENT '来源渠道',
  `status` TINYINT DEFAULT 1 COMMENT '状态: 0-流失 1-正常 2-待跟进',
  `owner_id` BIGINT UNSIGNED COMMENT '负责人ID',
  `remark` TEXT COMMENT '备注',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_corp_id` (`corp_id`),
  KEY `idx_owner_id` (`owner_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户表';

-- 标签表
CREATE TABLE IF NOT EXISTS `tag` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `corp_id` BIGINT UNSIGNED NOT NULL COMMENT '企业ID',
  `name` VARCHAR(50) NOT NULL COMMENT '标签名',
  `group_name` VARCHAR(50) COMMENT '标签组',
  `color` VARCHAR(20) DEFAULT '#409EFF' COMMENT '颜色',
  `type` TINYINT DEFAULT 0 COMMENT '类型: 0-手动 1-自动',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_corp_id` (`corp_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签表';

-- 客户标签关联表
CREATE TABLE IF NOT EXISTS `customer_tag` (
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `tag_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`customer_id`, `tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户标签关联表';

-- =============================================
-- SOP 运营模块
-- =============================================

-- SOP模板表
CREATE TABLE IF NOT EXISTS `sop_template` (
  `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `corp_id` BIGINT UNSIGNED NOT NULL COMMENT '企业ID',
  `name` VARCHAR(100) NOT NULL COMMENT '模板名称',
  `description` TEXT COMMENT '描述',
  `type` VARCHAR(20) DEFAULT 'customer' COMMENT '类型: customer/group',
  `trigger_type` VARCHAR(30) DEFAULT 'manual' COMMENT '触发方式: manual/auto/schedule',
  `status` TINYINT DEFAULT 0 COMMENT '状态: 0-草稿 1-启用 2-停用',
  `creator_id` BIGINT UNSIGNED COMMENT '创建人ID',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_corp_id` (`corp_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SOP模板表';

-- SOP步骤表
CREATE TABLE IF NOT EXISTS `sop_step` (
  `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `template_id` BIGINT UNSIGNED NOT NULL COMMENT '所属模板ID',
  `step_order` INT NOT NULL COMMENT '步骤顺序',
  `name` VARCHAR(100) NOT NULL COMMENT '步骤名称',
  `action_type` VARCHAR(30) NOT NULL COMMENT '动作类型: send_message/add_tag/send_friend_circle',
  `action_content` JSON COMMENT '动作内容JSON',
  `delay_minutes` INT DEFAULT 0 COMMENT '延迟分钟数',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_template_id` (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SOP步骤表';

-- SOP执行记录表
CREATE TABLE IF NOT EXISTS `sop_execution` (
  `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `template_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED COMMENT '客户ID',
  `current_step` INT DEFAULT 1,
  `status` VARCHAR(20) DEFAULT 'running' COMMENT '状态: running/completed/paused/failed',
  `started_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `completed_at` DATETIME,
  KEY `idx_template_id` (`template_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SOP执行记录表';

-- 群发任务表
CREATE TABLE IF NOT EXISTS `mass_task` (
  `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `corp_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL COMMENT '任务名称',
  `content` JSON COMMENT '发送内容',
  `target_type` VARCHAR(20) DEFAULT 'customer' COMMENT '目标: customer/group',
  `target_count` INT DEFAULT 0 COMMENT '目标数量',
  `sent_count` INT DEFAULT 0 COMMENT '已发送数量',
  `status` VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending/running/completed/cancelled',
  `creator_id` BIGINT UNSIGNED,
  `scheduled_at` DATETIME COMMENT '计划执行时间',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
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
INSERT INTO `customer` (`corp_id`, `name`, `gender`, `mobile`, `source`, `status`, `owner_id`) VALUES
(1, '张三', 1, '13800001001', 'douyin', 1, 1),
(1, '李四', 2, '13800001002', 'xiaohongshu', 2, 1),
(1, '王五', 1, '13800001003', 'wechat', 1, 1),
(1, '赵六', 2, '13800001004', 'douyin', 1, 1),
(1, '钱七', 1, '13800001005', 'offline', 2, 1),
(1, '孙八', 2, '13800001006', 'xiaohongshu', 1, 1),
(1, '周九', 1, '13800001007', 'wechat', 1, 1),
(1, '吴十', 2, '13800001008', 'douyin', 0, 1)
ON DUPLICATE KEY UPDATE `name` = `name`;

-- 示例标签
INSERT INTO `tag` (`corp_id`, `name`, `group_name`, `color`) VALUES
(1, '高意向', '意向度', '#67C23A'),
(1, '中意向', '意向度', '#E6A23C'),
(1, '低意向', '意向度', '#F56C6C'),
(1, '抖音来源', '渠道', '#409EFF'),
(1, '小红书来源', '渠道', '#E6A23C'),
(1, 'VIP客户', '等级', '#F56C6C'),
(1, '新客户', '阶段', '#909399'),
(1, '已转化', '阶段', '#67C23A')
ON DUPLICATE KEY UPDATE `name` = `name`;

-- 示例SOP模板
INSERT INTO `sop_template` (`corp_id`, `name`, `description`, `type`, `trigger_type`, `status`, `creator_id`) VALUES
(1, '新客欢迎SOP', '新客户添加后自动发送欢迎消息并打标签', 'customer', 'auto', 1, 1),
(1, '7天跟进SOP', '客户添加7天后未转化的跟进流程', 'customer', 'schedule', 1, 1),
(1, '社群运营SOP', '新群成员入群欢迎+引导流程', 'group', 'auto', 0, 1)
ON DUPLICATE KEY UPDATE `name` = `name`;

-- SOP步骤
INSERT INTO `sop_step` (`template_id`, `step_order`, `name`, `action_type`, `action_content`, `delay_minutes`) VALUES
(1, 1, '发送欢迎消息', 'send_message', '{"text": "您好！欢迎关注我们，很高兴认识您~"}', 0),
(1, 2, '打标签', 'add_tag', '{"tagName": "新客户"}', 5),
(1, 3, '发送产品介绍', 'send_message', '{"text": "这是我们的产品介绍，希望对您有帮助"}', 60),
(2, 1, '发送跟进消息', 'send_message', '{"text": "您好，最近有什么可以帮到您的吗？"}', 0),
(2, 2, '发送优惠信息', 'send_message', '{"text": "我们近期有特别优惠活动，感兴趣可以了解一下"}', 1440)
ON DUPLICATE KEY UPDATE `name` = `name`;

