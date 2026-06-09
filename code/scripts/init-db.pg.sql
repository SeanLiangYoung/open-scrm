-- PostgreSQL 初始化（与 TypeORM 实体对齐；首次挂载数据卷时执行一次）
SET client_encoding = 'UTF8';

-- ========== 认证 / 权限 ==========

CREATE TABLE IF NOT EXISTS "user" (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  username VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  real_name VARCHAR(50),
  mobile VARCHAR(20),
  email VARCHAR(100),
  avatar VARCHAR(255),
  wework_userid VARCHAR(64),
  status SMALLINT DEFAULT 1,
  is_admin SMALLINT DEFAULT 0,
  last_login_time TIMESTAMP NULL,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_user_corp_username UNIQUE (corp_id, username)
);
CREATE INDEX IF NOT EXISTS idx_user_mobile ON "user" (mobile);
CREATE INDEX IF NOT EXISTS idx_user_status ON "user" (status);

CREATE TABLE IF NOT EXISTS role (
  id SERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  role_name VARCHAR(50) NOT NULL,
  role_code VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_role_corp_code UNIQUE (corp_id, role_code)
);

CREATE TABLE IF NOT EXISTS user_role (
  user_id BIGINT NOT NULL,
  role_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS permission (
  id SERIAL PRIMARY KEY,
  permission_name VARCHAR(50) NOT NULL,
  permission_code VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL,
  parent_id INTEGER DEFAULT 0,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_permission_code UNIQUE (permission_code)
);

CREATE TABLE IF NOT EXISTS role_permission (
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);

-- ========== 客户 ==========

CREATE TABLE IF NOT EXISTS customer (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  external_userid VARCHAR(100) NOT NULL DEFAULT '',
  name VARCHAR(100),
  mobile VARCHAR(20),
  avatar VARCHAR(255),
  type SMALLINT DEFAULT 1,
  gender SMALLINT,
  unionid VARCHAR(100),
  province VARCHAR(50),
  city VARCHAR(50),
  follow_user_id BIGINT,
  add_time TIMESTAMP NULL,
  channel VARCHAR(50),
  status SMALLINT DEFAULT 1,
  remark TEXT,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_corp ON customer (corp_id);
CREATE INDEX IF NOT EXISTS idx_customer_follow ON customer (follow_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_status ON customer (status);

CREATE TABLE IF NOT EXISTS customer_tag (
  id SERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  tag_name VARCHAR(50) NOT NULL,
  tag_type SMALLINT DEFAULT 1,
  tag_color VARCHAR(10),
  parent_id INTEGER DEFAULT 0,
  sort INTEGER DEFAULT 0,
  is_auto SMALLINT DEFAULT 0,
  status SMALLINT DEFAULT 1,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_tag_corp ON customer_tag (corp_id);

CREATE TABLE IF NOT EXISTS customer_tag_relation (
  customer_id BIGINT NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (customer_id, tag_id)
);

-- ========== SOP / 群发 ==========

CREATE TABLE IF NOT EXISTS sop_template (
  id SERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  template_type SMALLINT NOT NULL DEFAULT 1,
  trigger_type SMALLINT NOT NULL DEFAULT 4,
  trigger_condition JSONB,
  description TEXT,
  status SMALLINT DEFAULT 1,
  create_user_id BIGINT,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sop_template_corp ON sop_template (corp_id);

CREATE TABLE IF NOT EXISTS sop_step (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL,
  step_name VARCHAR(100) NOT NULL,
  step_type SMALLINT NOT NULL DEFAULT 1,
  delay_time INTEGER DEFAULT 0,
  delay_unit VARCHAR(10) DEFAULT 'minute',
  action_type SMALLINT,
  action_content JSONB NOT NULL DEFAULT '{}',
  status SMALLINT DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_sop_step_template ON sop_step (template_id);

CREATE TABLE IF NOT EXISTS sop_execution (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  template_id INTEGER NOT NULL,
  template_name VARCHAR(100),
  target_type SMALLINT NOT NULL DEFAULT 1,
  customer_id BIGINT,
  group_id BIGINT,
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  status SMALLINT DEFAULT 0,
  start_time TIMESTAMP NULL,
  complete_time TIMESTAMP NULL,
  error_message VARCHAR(500),
  execution_log JSONB,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sop_exec_template ON sop_execution (template_id);

CREATE TABLE IF NOT EXISTS mass_task (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  task_name VARCHAR(100) NOT NULL,
  task_type SMALLINT NOT NULL,
  target_type SMALLINT NOT NULL,
  target_ids JSONB NOT NULL,
  target_count INTEGER DEFAULT 0,
  message_content TEXT,
  message_type SMALLINT,
  action_data JSONB,
  scheduled_time TIMESTAMP NULL,
  status SMALLINT DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  start_time TIMESTAMP NULL,
  complete_time TIMESTAMP NULL,
  error_message VARCHAR(500),
  create_user_id BIGINT,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mass_task_corp ON mass_task (corp_id);

-- ========== 获客 ==========

CREATE TABLE IF NOT EXISTS channel_code (
  id SERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  code_name VARCHAR(100) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  qr_code_url VARCHAR(255),
  config_id VARCHAR(100),
  staff_ids JSONB,
  welcome_msg TEXT,
  auto_tag_ids JSONB,
  scan_count INTEGER DEFAULT 0,
  add_count INTEGER DEFAULT 0,
  status SMALLINT DEFAULT 1,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_channel_code_corp ON channel_code (corp_id);

-- Sprint 9：扫码归因占位（与 docs/facts/attribution-identity-keys-v0.1 对齐）
CREATE TABLE IF NOT EXISTS channel_scan_touch (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  channel_code_id INT NOT NULL,
  utm_campaign VARCHAR(255),
  creative_id VARCHAR(128),
  region_pack_id VARCHAR(64),
  payload JSONB,
  create_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_channel_scan_touch_code_time
  ON channel_scan_touch (corp_id, channel_code_id, create_time DESC);

CREATE TABLE IF NOT EXISTS platform_account (
  id SERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  platform VARCHAR(20) NOT NULL,
  account_name VARCHAR(100),
  account_id VARCHAR(100),
  access_token VARCHAR(500),
  refresh_token VARCHAR(500),
  expires_time TIMESTAMP NULL,
  status SMALLINT DEFAULT 1,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_platform_account_corp ON platform_account (corp_id);

CREATE TABLE IF NOT EXISTS content (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  account_id INTEGER NOT NULL,
  platform VARCHAR(20) NOT NULL,
  content_type SMALLINT NOT NULL,
  title VARCHAR(255),
  content TEXT,
  media_urls JSONB,
  cover_url VARCHAR(255),
  topics JSONB,
  status SMALLINT DEFAULT 0,
  publish_time TIMESTAMP NULL,
  platform_content_id VARCHAR(100),
  create_user_id BIGINT,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ========== 内容工坊 (content-generation-service) ==========

CREATE TABLE IF NOT EXISTS content_source (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  summary TEXT,
  keywords JSONB,
  tone VARCHAR(100),
  target_audience VARCHAR(255),
  kb_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  kb_query VARCHAR(500),
  kb_project_id VARCHAR(255),
  create_user_id BIGINT,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_content_source_corp_updated
  ON content_source (corp_id, update_time DESC);

CREATE TABLE IF NOT EXISTS generation_job (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  source_id BIGINT NOT NULL,
  channels JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  llm_model VARCHAR(100),
  prompt_version VARCHAR(50),
  kb_mode VARCHAR(20) NOT NULL DEFAULT 'off',
  kb_hits INT NOT NULL DEFAULT 0,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_generation_job_source_time
  ON generation_job (source_id, create_time DESC);

CREATE TABLE IF NOT EXISTS content_variant (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  job_id BIGINT NOT NULL,
  source_id BIGINT NOT NULL,
  channel VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  body TEXT,
  structured JSONB,
  quality_flags JSONB,
  version INT NOT NULL DEFAULT 1,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_content_variant_job ON content_variant (job_id);
CREATE INDEX IF NOT EXISTS idx_content_variant_source_channel
  ON content_variant (source_id, channel);

-- ========== 消息 ==========

CREATE TABLE IF NOT EXISTS notification (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  notification_type SMALLINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  link_url VARCHAR(500),
  extra JSONB,
  is_read SMALLINT DEFAULT 0,
  read_time TIMESTAMP NULL,
  expire_time TIMESTAMP NULL,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_template (
  id SERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  template_type SMALLINT NOT NULL,
  message_type SMALLINT NOT NULL,
  content TEXT NOT NULL,
  extra JSONB,
  status SMALLINT DEFAULT 1,
  create_user_id BIGINT,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_log (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  template_id INTEGER,
  message_type SMALLINT NOT NULL,
  target_type SMALLINT NOT NULL,
  target_id BIGINT NOT NULL,
  target_name VARCHAR(100),
  content TEXT NOT NULL,
  extra JSONB,
  send_status SMALLINT DEFAULT 0,
  send_time TIMESTAMP NULL,
  fail_reason VARCHAR(500),
  retry_count INTEGER DEFAULT 0,
  external_id VARCHAR(100),
  idempotency_key VARCHAR(128),
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sprint 3：幂等发送（旧库升级时补列；新库已在 CREATE 中包含）
ALTER TABLE message_log ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
CREATE UNIQUE INDEX IF NOT EXISTS ux_message_log_corp_idempotency
  ON message_log (corp_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Sprint 8：营销同意留痕（出海 Phase 1 / CON-03 闸门数据源）
CREATE TABLE IF NOT EXISTS consent_record (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  subject_type VARCHAR(32) NOT NULL,
  subject_id BIGINT NOT NULL,
  purpose VARCHAR(32) NOT NULL,
  policy_version VARCHAR(64),
  channel VARCHAR(32),
  locale VARCHAR(16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_consent_record_lookup
  ON consent_record (corp_id, subject_type, subject_id, purpose);

-- ========== 集成 ==========

CREATE TABLE IF NOT EXISTS wework_config (
  id SERIAL PRIMARY KEY,
  corp_id VARCHAR(100) NOT NULL UNIQUE,
  corp_secret VARCHAR(200) NOT NULL,
  agent_id INTEGER,
  contact_secret VARCHAR(200),
  customer_secret VARCHAR(200),
  callback_token VARCHAR(100),
  encoding_aes_key VARCHAR(100),
  status SMALLINT DEFAULT 1,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_log (
  id BIGSERIAL PRIMARY KEY,
  corp_id VARCHAR(100) NOT NULL,
  sync_type VARCHAR(50) NOT NULL,
  status SMALLINT NOT NULL,
  total_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  start_time TIMESTAMP NULL,
  end_time TIMESTAMP NULL,
  error_message TEXT,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ========== 财务（order 为保留字） ==========

CREATE TABLE IF NOT EXISTS "order" (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  order_no VARCHAR(64) NOT NULL UNIQUE,
  product_name VARCHAR(255) NOT NULL,
  product_type SMALLINT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  actual_amount DECIMAL(10,2) NOT NULL,
  status SMALLINT DEFAULT 1,
  pay_time TIMESTAMP NULL,
  cancel_time TIMESTAMP NULL,
  expire_time TIMESTAMP NULL,
  detail JSONB,
  remark TEXT,
  create_user_id BIGINT,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL,
  order_no VARCHAR(64) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  transaction_id VARCHAR(64),
  amount DECIMAL(10,2) NOT NULL,
  status SMALLINT DEFAULT 1,
  pay_time TIMESTAMP NULL,
  refund_time TIMESTAMP NULL,
  refund_amount DECIMAL(10,2) DEFAULT 0,
  detail JSONB,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  invoice_no VARCHAR(64),
  invoice_type SMALLINT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,4) NOT NULL,
  buyer_name VARCHAR(255) NOT NULL,
  buyer_tax_no VARCHAR(64) NOT NULL,
  buyer_address VARCHAR(255),
  buyer_phone VARCHAR(32),
  buyer_bank VARCHAR(255),
  buyer_account VARCHAR(64),
  status SMALLINT DEFAULT 1,
  issue_time TIMESTAMP NULL,
  invoice_url VARCHAR(500),
  remark TEXT,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ========== 素材 ==========

CREATE TABLE IF NOT EXISTS asset_category (
  id SERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  parent_id INTEGER DEFAULT 0,
  name VARCHAR(100) NOT NULL,
  sort INTEGER DEFAULT 0,
  asset_count INTEGER DEFAULT 0,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  category_id INTEGER,
  name VARCHAR(255) NOT NULL,
  type SMALLINT NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type VARCHAR(100),
  thumbnail_url VARCHAR(500),
  width INTEGER DEFAULT 0,
  height INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 0,
  tags JSONB,
  use_count INTEGER DEFAULT 0,
  create_user_id BIGINT,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_usage (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  asset_id BIGINT NOT NULL,
  use_type VARCHAR(50) NOT NULL,
  ref_id BIGINT,
  use_user_id BIGINT,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ========== 分析 ==========

CREATE TABLE IF NOT EXISTS daily_stat (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  stat_date DATE NOT NULL,
  new_customer_count INTEGER DEFAULT 0,
  lost_customer_count INTEGER DEFAULT 0,
  active_customer_count INTEGER DEFAULT 0,
  total_customer_count INTEGER DEFAULT 0,
  active_staff_count INTEGER DEFAULT 0,
  total_staff_count INTEGER DEFAULT 0,
  message_send_count INTEGER DEFAULT 0,
  message_success_count INTEGER DEFAULT 0,
  message_fail_count INTEGER DEFAULT 0,
  sop_execute_count INTEGER DEFAULT 0,
  sop_success_count INTEGER DEFAULT 0,
  mass_task_count INTEGER DEFAULT 0,
  mass_send_count INTEGER DEFAULT 0,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_daily_stat_corp_date ON daily_stat (corp_id, stat_date);

CREATE TABLE IF NOT EXISTS channel_stat (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  channel VARCHAR(50) NOT NULL,
  stat_date DATE NOT NULL,
  scan_count INTEGER DEFAULT 0,
  add_customer_count INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  retention_1d INTEGER DEFAULT 0,
  retention_7d INTEGER DEFAULT 0,
  retention_30d INTEGER DEFAULT 0,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_stat (
  id BIGSERIAL PRIMARY KEY,
  corp_id BIGINT NOT NULL,
  staff_id BIGINT NOT NULL,
  stat_date DATE NOT NULL,
  customer_count INTEGER DEFAULT 0,
  new_customer_count INTEGER DEFAULT 0,
  lost_customer_count INTEGER DEFAULT 0,
  active_customer_count INTEGER DEFAULT 0,
  message_send_count INTEGER DEFAULT 0,
  message_reply_count INTEGER DEFAULT 0,
  reply_rate DECIMAL(5,2) DEFAULT 0,
  task_count INTEGER DEFAULT 0,
  task_completed_count INTEGER DEFAULT 0,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ========== 种子数据 ==========

INSERT INTO "user" (corp_id, username, password, real_name, is_admin, status)
VALUES (1, 'admin', '$2b$12$Vr7iDIPkR7e.QsfWs/iyQujwrS/Quwygpzi0zfJIrUOizIKb8jS9W', '系统管理员', 1, 1)
ON CONFLICT (corp_id, username) DO NOTHING;

INSERT INTO role (corp_id, role_name, role_code, description) VALUES
  (1, '超级管理员', 'super_admin', '拥有所有权限'),
  (1, '管理员', 'admin', '管理企业和用户'),
  (1, '运营人员', 'operator', '运营客户和SOP'),
  (1, '销售人员', 'sales', '管理客户和跟进'),
  (1, '查看者', 'viewer', '只能查看数据')
ON CONFLICT (corp_id, role_code) DO NOTHING;

-- Sprint 2 / 本地 E2E：企微回调验签与加解密（与 integration-service 单测向量一致，非真实 corp）
INSERT INTO wework_config (corp_id, corp_secret, callback_token, encoding_aes_key, status)
VALUES (
  'wx1234567890abcdef',
  'local_dev_placeholder_not_for_production',
  'scrm_s2_callback_token',
  'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
  1
) ON CONFLICT (corp_id) DO NOTHING;

INSERT INTO customer (corp_id, external_userid, name, gender, mobile, channel, status, follow_user_id) VALUES
(1, 'ext_001', '张三', 1, '13800001001', 'douyin', 1, 1),
(1, 'ext_002', '李四', 2, '13800001002', 'xiaohongshu', 1, 1),
(1, 'ext_003', '王五', 1, '13800001003', 'wechat', 1, 1),
(1, 'ext_004', '赵六', 2, '13800001004', 'douyin', 1, 1),
(1, 'ext_005', '钱七', 1, '13800001005', 'offline', 2, 1),
(1, 'ext_006', '孙八', 2, '13800001006', 'xiaohongshu', 1, 1),
(1, 'ext_007', '周九', 1, '13800001007', 'wechat', 1, 1),
(1, 'ext_008', '吴十', 2, '13800001008', 'douyin', 0, 1);

-- 客户 id=1（张三）具备 marketing 同意，供 Sprint 8 API E2E；其余客户默认无营销同意
INSERT INTO consent_record (corp_id, subject_type, subject_id, purpose, policy_version, channel, locale)
SELECT 1, 'customer', 1, 'marketing', 'v1-seed', 'init-db', 'zh-CN'
WHERE NOT EXISTS (
  SELECT 1 FROM consent_record c
  WHERE c.corp_id = 1 AND c.subject_type = 'customer' AND c.subject_id = 1
    AND c.purpose = 'marketing' AND c.revoked_at IS NULL
);

INSERT INTO customer_tag (corp_id, tag_name, tag_type, tag_color, status) VALUES
(1, '高意向', 4, '#67C23A', 1),
(1, '中意向', 4, '#E6A23C', 1),
(1, '低意向', 4, '#F56C6C', 1),
(1, '抖音来源', 1, '#409EFF', 1),
(1, '小红书来源', 1, '#E6A23C', 1),
(1, 'VIP客户', 4, '#F56C6C', 1),
(1, '新客户', 2, '#909399', 1),
(1, '已转化', 2, '#67C23A', 1);

INSERT INTO sop_template (corp_id, template_name, template_type, trigger_type, description, status, create_user_id) VALUES
(1, '新客欢迎SOP', 1, 1, '新客户添加后自动发送欢迎消息并打标签', 1, 1),
(1, '7天跟进SOP', 1, 4, '客户添加7天后未转化的跟进流程', 1, 1),
(1, '社群运营SOP', 2, 3, '新群成员入群欢迎+引导流程', 0, 1);

INSERT INTO sop_step (template_id, step_order, step_name, step_type, delay_time, delay_unit, action_type, action_content) VALUES
(1, 1, '发送欢迎消息', 1, 0, 'minute', 1, '{"text": "您好！欢迎关注我们"}'),
(1, 2, '打标签', 2, 5, 'minute', 2, '{"tagName": "新客户"}'),
(1, 3, '发送产品介绍', 1, 60, 'minute', 1, '{"text": "这是我们的产品介绍"}'),
(2, 1, '发送跟进消息', 1, 0, 'minute', 1, '{"text": "您好，最近有什么可以帮到您的吗？"}'),
(2, 2, '发送优惠信息', 1, 1440, 'minute', 1, '{"text": "我们近期有特别优惠活动"}');
