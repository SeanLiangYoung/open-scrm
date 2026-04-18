<div align="center">

# 🚀 Open SCRM

**开源企业级私域运营系统**

一个功能完整的企业级 SCRM (Social Customer Relationship Management) 私域运营平台

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-blue.svg)](https://www.typescriptlang.org)
[![Vue 3](https://img.shields.io/badge/Vue-3.3+-4FC08D.svg)](https://vuejs.org)
[![Midway](https://img.shields.io/badge/Midway-3.x-blue.svg)](https://midwayjs.org)

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [技术架构](#-技术架构) • [项目结构](#-项目结构) • [文档](#-文档) • [贡献指南](#-贡献指南)

</div>

---

## 📖 项目简介

Open SCRM 是一个完全开源的企业级私域运营系统，采用微服务架构，支持多渠道获客、智能化运营、数据分析等全链路功能。项目基于现代化技术栈构建，前端使用 Vue 3 + TypeScript，后端采用 Midway.js + TypeORM，支持企业微信、抖音、小红书等多平台集成。

### ✨ 为什么选择 Open SCRM？

- 🎯 **功能完整**: 覆盖获客、运营、分析全流程，开箱即用
- 🏗️ **架构先进**: 微服务架构 + Monorepo 管理，易于扩展和维护
- 💪 **生产就绪**: 完善的权限管理、数据安全、性能优化
- 📱 **多端支持**: PC端、移动端、小程序全覆盖
- 🔌 **易于集成**: 企业微信、抖音、小红书等主流平台无缝对接
- 📚 **文档齐全**: 详细的开发文档、API文档、部署指南

---

## 🎯 功能特性

### 核心功能模块

| 模块 | 功能描述 |
|------|---------|
| 🚀 **多渠道获客** | 抖音/小红书内容发布、渠道活码、引流链接、自动分配 |
| 👥 **客户管理** | 客户信息管理、标签体系、客户画像、智能分组 |
| 🤖 **SOP自动化** | 客户SOP、群SOP、自动化流程、任务提醒 |
| 💬 **社群运营** | 群管理、群活动、防骚扰规则、群数据分析 |
| 📤 **消息群发** | 批量群发、定向推送、消息模板、效果追踪 |
| 📊 **数据分析** | 12+维度数据看板、渠道分析、转化漏斗、ROI追踪 |
| 🏷️ **标签管理** | 标签配置、自动打标、行为标签、智能推荐 |
| 🎨 **营销工具** | 海报生成、朋友圈素材、活动裂变 |
| 🏪 **门店管理** | 多门店管理、门店活动、区域数据分析 |
| 💰 **财务管理** | 订单管理、收款对账、财务报表、发票管理 |
| 🔐 **权限管理** | RBAC权限模型、数据权限、操作审计 |
| 📱 **移动办公** | 移动端APP、小程序、随时随地办公 |

### 平台能力

- ✅ 企业微信深度集成
- ✅ 抖音/小红书内容发布
- ✅ 实时数据同步
- ✅ 智能预警提醒
- ✅ 客户资产保护
- ✅ 多租户SaaS架构
- ✅ 微服务部署
- ✅ Docker容器化

---

## 🏗️ 技术架构

### 技术栈

#### 前端技术栈
```
Vue 3.3+              组件化框架 (Composition API)
TypeScript 5.x        类型安全
Vite 4.x              构建工具
Pinia 2.x             状态管理
Element Plus 2.x      UI组件库
Nuxt 4                SSR/SSG框架
UniApp                跨端开发
ECharts 5.x           数据可视化
```

#### 后端技术栈
```
Node.js 18 LTS        运行环境
Midway.js 3.x         应用框架
TypeScript 5.x        开发语言
TypeORM 0.3.x         ORM框架
PostgreSQL 16         关系型数据库
Redis 7.0             缓存/会话
MongoDB 6.0           文档数据库
RabbitMQ 3.x          消息队列
```

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                          前端应用层                           │
├──────────┬──────────┬──────────┬──────────┬──────────┬───────┤
│ 官方网站 │ 管理平台 │ BI平台   │ 运营平台 │ 财务平台 │ 移动端 │
│ (Nuxt4) │ (Vue3)   │ (Vue3)   │ (Vue3)   │ (Vue3)   │(UniApp)│
└──────────┴──────────┴──────────┴──────────┴──────────┴───────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       API网关层 (7000)                        │
│        认证鉴权 • 路由转发 • 限流熔断 • 日志监控              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        微服务层                               │
├──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ 认证服务 │ 客户服务 │ 获客服务 │ 运营服务 │ 资产服务         │
│  (7001)  │  (7002)  │  (7003)  │  (7004)  │  (7005)          │
├──────────┼──────────┼──────────┼──────────┼──────────────────┤
│ 分析服务 │ 集成服务 │ 消息服务 │ 财务服务 │                  │
│  (7006)  │  (7007)  │  (7008)  │  (7009)  │                  │
└──────────┴──────────┴──────────┴──────────┴──────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                         数据层                                │
├──────────┬──────────┬──────────┬──────────────────────────────┤
│PostgreSQL│  Redis   │ MongoDB  │  RabbitMQ                    │
│ 业务数据 │  缓存    │ 日志数据 │  消息队列                    │
└──────────┴──────────┴──────────┴──────────────────────────────┘
```

---

## 📁 项目结构

```
open-scrm/
├── code/                          # 源代码目录
│   ├── apps/                      # 前端应用 (7个)
│   │   ├── official-website/      # 官方网站 (Nuxt 4) - 端口 3000
│   │   ├── admin-platform/        # 管理平台 (Vue 3) - 端口 3001
│   │   ├── bi-platform/           # BI分析平台 (Vue 3) - 端口 3002
│   │   ├── operation-platform/    # 运营平台 (Vue 3) - 端口 3003
│   │   ├── saas-admin/            # SaaS管理 (Vue 3) - 端口 3004
│   │   ├── finance-platform/      # 财务平台 (Vue 3) - 端口 3005
│   │   └── mobile-app/            # 移动端 (UniApp)
│   │
│   ├── services/                  # 后端微服务 (10个)
│   │   ├── gateway-service/       # API网关 - 端口 7000
│   │   ├── auth-service/          # 认证授权 - 端口 7001
│   │   ├── customer-service/      # 客户管理 - 端口 7002
│   │   ├── acquisition-service/   # 获客服务 - 端口 7003
│   │   ├── operation-service/     # 客户运营 - 端口 7004
│   │   ├── asset-service/         # 资产管理 - 端口 7005
│   │   ├── analytics-service/     # 数据分析 - 端口 7006
│   │   ├── integration-service/   # 第三方集成 - 端口 7007
│   │   ├── message-service/       # 消息推送 - 端口 7008
│   │   └── finance-service/       # 财务管理 - 端口 7009
│   │
│   ├── packages/                  # 共享包
│   │   ├── shared-types/          # 类型定义
│   │   ├── shared-utils/          # 工具函数
│   │   ├── shared-constants/      # 常量定义
│   │   ├── ui-components/         # UI组件
│   │   └── server-common/         # 后端公共模块
│   │
│   ├── scripts/                   # 脚本文件
│   └── docker-compose.yml         # Docker编排
│
├── docs/                          # 项目文档（规格、指南、模块说明等，统一入口见 docs/README.md）
│
└── README.md                      # 项目说明
```

详细的项目结构说明请查看 [folder-alias.json](folder-alias.json)

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 16
- Redis >= 7.0
- MongoDB >= 6.0 (可选)
- RabbitMQ >= 3.x (可选)

### 安装

```bash
# 1. 克隆项目
git clone https://github.com/SeanLiangYoung/open-scrm.git
cd open-scrm

# 2. 安装 pnpm (如果没有)
npm install -g pnpm

# 3. 安装依赖
cd code
pnpm install
```

### 启动开发环境

#### 方式一：使用 Docker Compose（推荐）

```bash
# 启动数据库等基础服务
cd code
docker-compose up -d

# 等待服务启动完成后，初始化数据库
cd services/auth-service
pnpm migration:run
pnpm seed
```

#### 方式二：手动安装依赖服务

请确保已安装并启动 PostgreSQL、Redis 等服务，然后配置相应的环境变量（参见 `code/env.example`）。

### 启动应用

```bash
# 在 code 目录下

# 启动所有后端服务
pnpm dev:service

# 启动所有前端应用
pnpm dev:web

# 或者单独启动某个服务/应用
cd services/gateway-service
pnpm dev

cd apps/operation-platform
pnpm dev
```

### 访问应用

- 官方网站: http://localhost:3000
- 管理平台: http://localhost:3001
- BI分析平台: http://localhost:3002
- 运营平台: http://localhost:3003
- API网关: http://localhost:7000
- API文档: http://localhost:7000/swagger-ui

默认管理员账号:
```
用户名: admin
密码: admin123
```

---

## 📚 文档

### 核心文档

- [文档索引](docs/README.md) - 仓库根目录 `docs/` 下的专题索引与工作流
- [需求规格说明书](docs/mvp/需求规格说明书.md) - 完整的功能需求和业务流程
- [技术选型文档](docs/mvp/技术选型.md) - 技术栈选择和架构设计
- [代码总览](docs/code/README.md) - 详细的代码结构说明
- [API文档](docs/api/) - RESTful API接口文档
- [架构设计](docs/architecture/) - 系统架构和设计文档
- [开发指南](docs/development/) - 开发规范和最佳实践

### 模块文档

各个应用和服务都有独立的 README 文档：

**前端应用:**
- [官方网站文档](docs/apps/official-website/README.md)
- [管理平台文档](docs/apps/admin-platform/README.md)
- [运营平台文档](docs/apps/operation-platform/README.md)
- [移动端文档](docs/apps/mobile-app/README.md)

**后端服务:**
- [网关服务文档](docs/services/gateway-service/README.md)
- [认证服务文档](docs/services/auth-service/README.md)
- [客户服务文档](docs/services/customer-service/README.md)

---

## 🛠️ 开发

### 命名规范

- **前端**: kebab-case (例如: `user-profile.vue`, `use-customer.ts`)
- **后端**: PascalCase (例如: `CustomerService`, `UserEntity`)
- **API路径**: kebab-case (例如: `/api/v1/customers`)

### 代码规范

```bash
# 代码检查
pnpm lint

# 代码格式化
pnpm format

# 类型检查
pnpm type-check

# 运行测试
pnpm test
```

### 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范:

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

示例:
```bash
git commit -m "feat(customer): 添加客户批量导入功能"
git commit -m "fix(auth): 修复token过期判断逻辑"
```

---

## 🚢 部署

### Docker 部署

```bash
# 构建镜像
cd code
pnpm build
docker-compose -f docker-compose.prod.yml build

# 启动服务
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes 部署

```bash
# 应用配置
kubectl apply -f k8s/

# 查看状态
kubectl get pods -n scrm
```

### 环境变量配置

各服务需要配置相应的环境变量，参考各模块的 `.env.example` 文件:

```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑配置
vim .env.local
```

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！无论是新功能、Bug修复、文档改进还是问题反馈。

### 贡献流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

### 开发建议

- 遵循项目的代码规范和提交规范
- 为新功能编写单元测试
- 更新相关文档
- 确保所有测试通过
- PR描述清晰，说明改动的目的和内容

### 问题反馈

如果你发现了 Bug 或有功能建议，请通过 [Issues](https://github.com/SeanLiangYoung/open-scrm/issues) 告诉我们。

---

## 📊 路线图

### v1.0 (当前)
- ✅ 基础架构搭建
- ✅ 核心业务模块
- ✅ 多平台集成
- ✅ 基础数据分析

### v1.1 (规划中)
- ⏳ AI智能客服
- ⏳ 高级数据分析
- ⏳ 营销自动化增强
- ⏳ 移动端功能完善

### v2.0 (远期)
- 📋 多语言支持
- 📋 插件市场
- 📋 低代码配置
- 📋 AI辅助运营

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

这意味着你可以自由地使用、复制、修改、合并、发布、分发本软件，无论是个人使用还是商业用途，只需保留原始版权声明。

---

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！

特别感谢以下开源项目：
- [Vue.js](https://vuejs.org/)
- [Midway.js](https://midwayjs.org/)
- [Element Plus](https://element-plus.org/)
- [TypeORM](https://typeorm.io/)
- [UniApp](https://uniapp.dcloud.net.cn/)

---

## 📞 联系我们

- 项目主页: https://github.com/SeanLiangYoung/open-scrm
- 问题反馈: https://github.com/SeanLiangYoung/open-scrm/issues
- 讨论区: https://github.com/SeanLiangYoung/open-scrm/discussions
- 邮箱: contact@open-scrm.com

---

## ⭐ Star History

如果这个项目对你有帮助，请给我们一个 Star ⭐️

[![Star History Chart](https://api.star-history.com/svg?repos=your-username/open-scrm&type=Date)](https://star-history.com/#your-username/open-scrm&Date)

---

<div align="center">

**Open SCRM** - 让私域运营更简单

Made with ❤️ by Open SCRM Team

</div>

