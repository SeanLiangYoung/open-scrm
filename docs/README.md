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
└── api/ …                  # （待创建）API 专题文档
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

- [Monorepo 说明](./code/README.md)（对应仓库 `code/`）
- [脚本目录](./scripts/README.md)（对应 `code/scripts/`）
- **[代码现状与文档索引](../code/docs/代码现状与文档索引.md)** — `code/` 运行时事实、端口、测试命令与文档阅读顺序
- **[可执行迭代计划（含 E2E）](../code/docs/迭代计划-E2E.md)** — Sprint 约定与端到端验证（**S7/S8** 见文档 [§2.5](../code/docs/迭代计划-E2E.md#next-sprints-s7-s8)）
- **[Harness 测试节奏](../code/docs/harness/README.md)** — `test:unit`、`test:e2e`、`test:e2e:sprint2`
- **出海私域（方法论 × 本地化 × AI）**：[设计草案](../code/docs/plans/2026-04-28-outbound-private-domain-localization-design.md) · [用户场景与功能映射](../code/docs/plans/2026-04-28-outbound-private-domain-user-scenarios-and-features.md) · [实现计划](../code/docs/plans/2026-04-28-outbound-private-domain-implementation-plan.md) · [区域矩阵](../code/docs/facts/outbound-private-domain-region-matrix.md)

### 模块文档

- **微服务**：[`services/`](./services/) 下各子目录 `README.md`
- **前端应用**：[`apps/`](./apps/) 下各子目录 `README.md`
- **共享包**：[`packages/`](./packages/) 下各子目录 `README.md`

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

