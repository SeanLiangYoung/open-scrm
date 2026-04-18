# SCRM系统 - 企业私域运营平台

> 基于Node.js + Midway.js + Vue3的企业级SCRM系统

> **当前工程事实（端口、数据库、测试命令）**请以 [`code/docs/代码现状与文档索引.md`](../../code/docs/代码现状与文档索引.md) 为准；下文为历史结构说明，部分「应用/端口」与仓库内实际 `code/apps` 可能不完全一致。

---

## 📋 项目概览

本项目是一个完整的企业级SCRM (Social Customer Relationship Management) 私域运营系统，采用微服务架构，支持多渠道获客、精细化运营、数据分析等全链路功能。

### 核心特性

- 🚀 **全域引流**: 支持抖音、小红书、微信等多平台引流至企业微信
- 🤖 **智能运营**: SOP自动化、智能标签、AI辅助运营
- 📊 **数据驱动**: 12+维度数据分析、BI看板、ROI追踪
- 🛡️ **资产保护**: 客户继承机制、流失预警、合规风控
- 🎯 **多端协同**: PC端、移动端、企微侧边栏全覆盖

---

## 🏗️ 技术架构

### 技术栈

**前端技术栈:**
- **框架**: Vue 3.3+ (Composition API)
- **构建工具**: Vite 4.x
- **语言**: TypeScript 5.x
- **状态管理**: Pinia 2.x
- **UI组件**: Element Plus、Ant Design Vue、NutUI
- **图表**: ECharts 5.x
- **官网**: Nuxt 4 (SSR/SSG)
- **移动端**: UniApp + NutUI

**后端技术栈:**
- **运行环境**: Node.js 18 LTS
- **应用框架**: Midway.js 3.x
- **语言**: TypeScript 5.x
- **ORM**: TypeORM 0.3.x
- **数据库**: PostgreSQL 16、Redis 7.0、MongoDB 6.0（可选）
- **消息队列**: RabbitMQ 3.x + Bull 4.x
- **API文档**: Swagger (Midway)

### 架构模式

- **前端**: Monorepo (pnpm workspace)
- **后端**: 微服务架构 (10个独立服务)
- **通信**: HTTP + RPC (gRPC) + MQ (RabbitMQ)

---

## 📁 项目结构

```
scrm-system/
├── apps/                       # 前端应用层 (7个独立应用)
│   ├── official-website/       # 官方网站 (Nuxt 4)
│   ├── admin-platform/         # 管理平台 (Vue3)
│   ├── bi-platform/            # BI分析平台 (Vue3)
│   ├── operation-platform/     # 运营平台 (Vue3)
│   ├── saas-admin/             # SaaS管理平台 (Vue3)
│   ├── finance-platform/       # 财务平台 (Vue3)
│   └── mobile-app/             # 移动端 (UniApp)
│
├── services/                   # 后端微服务层 (10个服务)
│   ├── gateway-service/        # API网关
│   ├── auth-service/           # 认证授权
│   ├── customer-service/       # 客户管理
│   ├── acquisition-service/    # 获客服务
│   ├── operation-service/      # 客户运营
│   ├── asset-service/          # 资产管理
│   ├── analytics-service/      # 数据分析
│   ├── integration-service/    # 第三方集成
│   ├── message-service/        # 消息推送
│   └── finance-service/        # 财务管理
│
├── packages/                   # 共享包
│   ├── shared-types/           # 共享类型定义
│   ├── shared-utils/           # 共享工具函数
│   ├── shared-constants/       # 共享常量
│   ├── ui-components/          # 共享UI组件
│   └── server-common/          # 后端公共模块
│
├── scripts/                    # 构建/部署脚本
└── .github/                    # CI/CD配置
```

文档索引见 [`docs/README.md`](../README.md)（本文件描述 `code/` 目录职责与结构）。

---

## 🚀 快速开始

### 环境要求

- **Node.js**: 18.x LTS
- **pnpm**: 8.x+
- **PostgreSQL**: 14+（推荐 16）
- **Redis**: 7.0+
- **MongoDB**: 6.0+
- **RabbitMQ**: 3.x+

### 安装依赖

```bash
# 安装pnpm (如果没有)
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 启动开发环境

**1. 启动数据库 (Docker Compose)**

```bash
docker compose up -d postgres redis
```

首次启动会在 PostgreSQL 容器中执行 `scripts/init-db.pg.sql`（仅新数据卷执行一次），创建库表并写入默认管理员等种子数据。

**2. 使用本机已有 PostgreSQL 时**

创建数据库 `scrm_dev`，并将 `scripts/init-db.pg.sql` 导入；通过环境变量连接：`DB_HOST`、`DB_PORT`（默认 `5432`）、`DB_USERNAME`/`DB_USER`、`DB_PASSWORD`、`DB_DATABASE`。

**3. 迁移脚本（若使用 TypeORM migration，而非仅依赖 init SQL）**

```bash
cd services/auth-service
pnpm migration:run
pnpm seed
```

**4. 启动后端服务**

```bash
# 启动所有服务
pnpm dev:service

# 或单独启动某个服务
cd services/gateway-service
pnpm dev
```

**5. 启动前端应用**

```bash
# 启动所有前端应用
pnpm dev:web

# 或单独启动某个应用
cd apps/operation-platform
pnpm dev
```

### 访问应用

- 官方网站: http://localhost:3000
- 管理平台: http://localhost:3001
- BI平台: http://localhost:3002
- 运营平台: http://localhost:3003
- SaaS管理: http://localhost:3004
- 财务平台: http://localhost:3005
- API网关: http://localhost:7000
- API文档: http://localhost:7000/swagger-ui

---

## 📦 模块说明

### 前端应用 (apps/)

| 应用 | 端口 | 用户角色 | 核心功能 |
|------|------|---------|---------|
| **官方网站** | 3000 | 访客 | 产品介绍、案例展示、价格套餐 |
| **管理平台** | 3001 | 企业管理者/IT管理员 | 企业管理、权限配置、系统设置 |
| **BI平台** | 3002 | 管理者/市场人员 | 数据概览、渠道分析、转化分析 |
| **运营平台** | 3003 | 运营/销售/市场 | 获客管理、客户运营、SOP配置 |
| **SaaS管理** | 3004 | 平台运营 | 租户管理、套餐管理、系统监控 |
| **财务平台** | 3005 | 财务人员 | 订单管理、收款管理、财务报表 |
| **移动端** | - | 销售人员 | 客户管理、待办任务、移动办公 |

### 后端服务 (services/)

| 服务 | 端口 | 职责 |
|------|------|------|
| **gateway-service** | 7000 | API网关、路由转发、认证鉴权、限流熔断 |
| **auth-service** | 7001 | 用户认证、权限管理、JWT签发 |
| **customer-service** | 7002 | 客户信息管理、标签管理、客户画像 |
| **acquisition-service** | 7003 | 多渠道获客、活码管理、内容发布 |
| **operation-service** | 7004 | 客户运营、SOP管理、消息群发 |
| **asset-service** | 7005 | 客户资产管理、智能预警、数据统计 |
| **analytics-service** | 7006 | 数据分析、BI报表、指标计算 |
| **integration-service** | 7007 | 企微/抖音/小红书第三方集成 |
| **message-service** | 7008 | 消息推送、通知管理、模板管理 |
| **finance-service** | 7009 | 订单管理、支付对接、财务结算 |

---

## 🛠️ 开发指南

### 命名规范

**前端 (kebab-case):**
- 文件/组件: `user-profile.vue`
- Hooks: `use-customer.ts`
- 优先使用 Composition API + Hooks

**后端 (PascalCase):**
- 类/服务: `CustomerService`
- 实体: `CustomerEntity`
- DTO: `CreateCustomerDto`
- API路径: `/api/v1/customers` (kebab-case)

### 代码规范

```bash
# 代码检查
pnpm lint

# 代码格式化
pnpm format

# 类型检查
pnpm type-check
```

### 测试命令

```bash
# 运行完整测试
pnpm test

# 仅测试构建
pnpm test:build

# 仅测试类型检查
pnpm test:type

# 生成测试报告
pnpm test:report

# 详细输出
pnpm test:verbose
```

**测试说明**: [tests/README.md](../tests/README.md)  
**测试脚本文档**: [scripts/test/README.md](../scripts/test/README.md)  
**测试报告目录**: [tests/](../tests/)

### 提交规范

遵循 Conventional Commits:

```
feat: 新功能
fix: Bug修复
docs: 文档更新
style: 代码格式
refactor: 重构
perf: 性能优化
test: 测试相关
chore: 构建/工具变动
```

---

## 📚 文档

- [需求规格说明书](../mvp/需求规格说明书.md)
- [技术选型文档](../mvp/技术选型.md)
- [API文档](../api/)
- [架构设计](../architecture/)
- [开发文档](../development/)

---

## 🔒 环境变量

每个服务/应用需要配置相应的环境变量，参考各模块的 `.env.example` 文件。

**关键环境变量:**
- `NODE_ENV`: 运行环境 (development/production)
- `DB_HOST/DB_PORT`: 数据库连接
- `REDIS_HOST/REDIS_PORT`: Redis连接
- `RABBITMQ_URL`: RabbitMQ连接
- `JWT_SECRET`: JWT密钥
- `OSS_*`: 对象存储配置
- `WEWORK_*`: 企业微信配置

---

## 🚢 部署

### Docker部署

```bash
# 构建镜像
pnpm build:docker

# 启动所有服务
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes部署

```bash
# 应用K8s配置
kubectl apply -f k8s/

# 查看部署状态
kubectl get pods -n scrm
```

---

## 📊 监控与日志

- **监控**: Prometheus + Grafana (http://localhost:9090)
- **日志**: winston + ELK (可选)
- **链路追踪**: Jaeger (可选)

---

## 🤝 贡献指南

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: add some amazing feature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

---

## 📄 许可证

本项目为内部项目，未经授权不得外传。

---

## 👥 团队

- **产品团队**: 需求规划、产品设计
- **技术团队**: 架构设计、系统开发
- **运营团队**: 产品运营、用户支持

---

## 📞 联系方式

- 项目经理: [待填写]
- 技术负责人: [待填写]
- 问题反馈: [待填写]

---

**最后更新**: 2026-04-19（增加与 `code/docs` 事实文档的交叉引用）  
**项目版本**: v1.0.0

