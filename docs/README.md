# 项目文档

本目录位于仓库根目录 **`docs/`**，集中存放规格说明、技术选型、指南、各模块 README、脚本说明与测试报告索引；源码仍在 `code/`，新增文档默认写在本目录并保持链接可用。

---

## 📁 目录结构

```
docs/
├── README.md               # 本索引
├── mvp/                    # 需求规格、技术选型
├── guides/                 # 快速开始、环境变量、脚本速查
├── code/                   # Monorepo 代码总览（对应 code/ 目录）
├── workflow/               # 协作与工作流
├── refs/                   # 外部参考材料
├── services/               # 各微服务说明（与 code/services/* 一一对应）
├── apps/                   # 各前端应用说明（与 code/apps/* 一一对应）
├── packages/               # 共享包说明（与 code/packages/* 一一对应）
├── scripts/                # scripts 目录说明（含 test/、run/）
├── tests/                  # 测试报告归档
├── plans/                  # 路线图等
└── api/ …                  # API 专题文档（含 content-studio）
```

---

## 🔗 文档索引

### 协作与工作流

- **[workflow/README.md](./workflow/README.md)** — 多人协同、Git/PR、工程原则、CI/CD 意图、本地环境与团队对齐。

### 测试报告

- **[tests/README.md](./tests/README.md)** — 报告命名、归档与清理说明。

### 参考材料（外部调研）

- **[refs/README.md](./refs/README.md)** — 竞品与调研笔记索引。

### 规格与选型（`mvp/`）

- [索引](./mvp/README.md)
- [需求规格说明书](./mvp/需求规格说明书.md)
- [技术选型](./mvp/技术选型.md)

> 说明：`mvp/` 中部分早期架构图仍写 MySQL；**当前运行时主库为 PostgreSQL 16**（见 `code/docker-compose.yml` 与 [`code/docs/代码现状与文档索引.md`](../code/docs/代码现状与文档索引.md)）。

### 指南（`guides/`）

- [快速开始](./guides/快速开始.md)
- [环境配置说明](./guides/环境配置说明.md)
- [脚本命令速查](./guides/脚本命令速查.md)

### 代码与工程

- [素材写入边界修复](./tests/2026-10-26-asset-write-integrity.md) — 编号、企业引用、层级与原子计数
- [素材网关接入及下游错误传播](./tests/2026-10-26-asset-gateway-routing.md) — 受保护路径映射、真实HTTP与兼容回归

- [夜间量化执行计划（2026-10-25 至 26 日）](./plans/2026-10-25-overnight-execution.md) — 并发任务、九个里程碑、验收条件与早晨交付
- [本企业员工目录与运营人员选择](./plans/2026-10-26-tenant-staff-operations.md) — 夜间持续批次：可信员工查询、通知接收人归属、客户/SOP人员选择与双企业HTTP验证
- [企业同名登录与刷新边界](./plans/2026-10-26-tenant-login-disambiguation.md) — 企业选择、同名消歧及真实HTTP/UI证据
- [服务运行就绪与统一验收](./plans/2026-10-26-runtime-readiness-and-verification.md) — 五服务实际启动、统计网关及22阶段统一入口
- [会话切换后的迟到响应](./plans/2026-10-26-session-response-races.md) — 已复现旧请求401清除新会话，修复与回归进行中
- [失败消息重试企业隔离](./plans/2026-10-26-message-retry-isolation.md) — 已发现重试缺少企业过滤，红绿回归进行中
- [持续验收证据索引](./tests/2026-10-26-overnight-verification.md) — 历史快照、最新复验、限制和待办
- [明确消息渠道能力](./plans/2026-10-26-explicit-message-capabilities.md) — 未接通渠道拒绝、历史幂等与额度副作用、SOP显式模拟
- [SOP路径编号](./plans/2026-10-26-sop-path-identifiers.md) — 非法编号拒绝及原模板保留
- [三个运营业务闭环](./plans/2026-10-26-next-business-slices.md) — 通知真实同事、消息日志人工Mock重试、客户授权证据操作，分工与量化验收
- [业务可靠性修复计划与验证记录](./plans/2026-10-25-business-reliability.md) — 跟进记录企业隔离、统计快照语义、SOP 控制、企微协议兼容与尚未验证的边界
- [Monorepo 说明](./code/README.md)（对应仓库 `code/`）
- [脚本目录](./scripts/README.md)（对应 `code/scripts/`）
- **[代码现状与文档索引](../code/docs/代码现状与文档索引.md)** — `code/` 运行时事实、端口、测试命令与文档阅读顺序
- **[可执行迭代计划（含 E2E）](../code/docs/迭代计划-E2E.md)** — Sprint 约定与端到端验证（**S7/S8** 见文档 [§2.5](../code/docs/迭代计划-E2E.md#next-sprints-s7-s8)）
- **[Harness 测试节奏](../code/docs/harness/README.md)** — `test:unit`、`test:e2e`、`test:e2e:sprint2`
- **出海私域（方法论 × 本地化 × AI）**：[设计草案](../code/docs/plans/2026-04-28-outbound-private-domain-localization-design.md) · [用户场景与功能映射](../code/docs/plans/2026-04-28-outbound-private-domain-user-scenarios-and-features.md) · [实现计划](../code/docs/plans/2026-04-28-outbound-private-domain-implementation-plan.md) · [区域矩阵](../code/docs/facts/outbound-private-domain-region-matrix.md)

### 本轮续办验收

- [管理员写入与角色事务](./tests/2026-10-26-admin-write-validation.md) — 密码规则、路径校验和完整关系保存

- [三组修复与50阶段交付记录](./tests/2026-10-26-resumed-delivery.md) — 本轮进度、完整验收清单与剩余问题
- [扫码计数与持久幂等](./tests/2026-10-26-channel-scan-reliability.md) — 事务、并发、失败重试和切换限制
- [内容工作台编号与批推](./tests/2026-10-26-content-studio-identifiers.md) — 规范路径、实际bigint水合及外部桩边界

### 模块文档

- **微服务**：[`services/`](./services/) 下各子目录 `README.md`
- **前端应用**：[`apps/`](./apps/) 下各子目录 `README.md`
- **共享包**：[`packages/`](./packages/) 下各子目录 `README.md`

### 路线图（`plans/`）

- [系统分阶段实施路线](./plans/2026-04-18-system-execution-roadmap.md)
- [多平台内容生成服务](./plans/2026-06-04-content-generation-service.md) — 核心内容源 → 多平台形态（参照 dbskill 方法论）
- [AI 原生个人创作中心](./plans/2026-06-05-ai-native-creation-center.md) — llm-wiki 知识库 + 内容系统核心 + 多平台生成/发布闭环
- [内容工坊用户流程对齐](./plans/2026-06-09-content-studio-wiki-compose-flow.md) — wiki 选材 → 核心稿合成 → 定稿 → 多渠道生成 → 一键发布
- **[Studio 运行契约](./facts/studio.md)** — 创作中心三层架构、env、API 与失败模式

### API 契约（`api/`）

- [Content Studio / 内容工坊](./api/content-studio/README.md) — `/api/v1/content-studio/*` 与 E2E 验证

### 仓库入口

- **[仓库 README](../README.md)** — 项目主文档
- **[开发计划](./开发计划.md)** — 端口与服务约定

---

## 📝 文档规范

### Markdown格式

- 使用标准Markdown语法
- 代码块标注语言类型
- 表格对齐
- 链接使用相对路径

### 文档结构

每个文档应包含：
1. **标题和概述**
2. **目录** (长文档)
3. **主要内容**
4. **示例代码** (如适用)
5. **参考链接**
6. **更新日期**

### 命名规范

- 使用kebab-case: `api-documentation.md`
- 见名知意
- 避免中文命名（内容可以是中文）

---

## 🔄 文档更新

### 更新频率

- **测试报告**: 每次测试自动生成
- **API文档**: 接口变更时更新
- **架构文档**: 架构调整时更新
- **开发文档**: 规范变更时更新

### 更新流程

1. 修改文档
2. 提交PR
3. Code Review
4. 合并到主分支

---

## 📞 文档贡献

欢迎完善项目文档！

### 如何贡献

1. Fork项目
2. 创建文档分支
3. 编写/更新文档
4. 提交PR

### 文档审核

- 内容准确性
- 格式规范性
- 可读性
- 示例完整性

---

**创建时间**: 2025-10-28  
**最后更新**: 2025-10-28

