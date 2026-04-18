# Scripts 目录说明

本目录包含项目的各种脚本工具。

## 📁 目录结构

```
scripts/
├── run/                           # 运行相关脚本
│   ├── start-all-services.ps1    # 启动所有后端服务
│   ├── stop-all-services.ps1     # 停止所有后端服务
│   ├── check-services.ps1        # 检查服务状态
│   ├── start-gateway.ps1         # 启动网关服务
│   ├── start-auth.ps1            # 启动认证服务
│   ├── start-customer.ps1        # 启动客户服务
│   ├── start-acquisition.ps1     # 启动获客服务
│   ├── start-operation.ps1       # 启动运营服务
│   ├── start-asset.ps1           # 启动素材服务
│   ├── start-message.ps1         # 启动消息服务
│   ├── start-integration.ps1     # 启动集成服务
│   ├── start-analytics.ps1       # 启动分析服务
│   ├── start-finance.ps1         # 启动财务服务
│   └── README.md                 # 运行脚本说明
├── test/                          # 测试相关脚本
│   ├── build-test.ps1            # 编译测试脚本
│   ├── type-check.ps1            # 类型检查脚本
│   ├── full-test.ps1             # 完整测试脚本
│   └── README.md                 # 测试脚本说明
├── init-db.sql                   # 数据库初始化脚本
├── install-superpowers-codex.sh  # Codex Superpowers 安装脚本
├── prometheus.yml                # Prometheus 配置
└── README.md                     # 本文件
```

## 🚀 服务管理脚本

### 启动单个服务

快速启动某个特定服务，适合开发调试：

```powershell
# 使用 pnpm 命令（推荐）
pnpm run start:gateway      # 启动 API 网关 (7001)
pnpm run start:auth         # 启动认证服务 (7000)
pnpm run start:customer     # 启动客户服务 (7002)
pnpm run start:acquisition  # 启动获客服务 (7003)
pnpm run start:operation    # 启动运营服务 (7004)
pnpm run start:asset        # 启动素材服务 (7005)
pnpm run start:message      # 启动消息服务 (7006)
pnpm run start:integration  # 启动集成服务 (7007)
pnpm run start:analytics    # 启动分析服务 (7008)
pnpm run start:finance      # 启动财务服务 (7009)

# 或直接执行脚本
.\scripts\run\start-gateway.ps1
.\scripts\run\start-auth.ps1
# ... 其他服务
```

**更多详情**: 查看 [run/README.md](run/README.md)

### 启动所有服务

一键启动所有10个后端微服务，每个服务在独立窗口中运行。

```powershell
# 在项目根目录执行
.\scripts\run\start-all-services.ps1

# 或使用 npm 命令
pnpm run start:all
```

**功能特性：**
- ✅ 自动检查 pnpm 是否安装
- ✅ 自动检查并安装依赖
- ✅ 每个服务独立窗口，便于查看日志
- ✅ 显示启动进度和结果
- ✅ 启动失败自动提示
- ✅ 显示服务地址列表

**启动的服务：**
- gateway-service (7001) - API网关
- auth-service (7000) - 认证授权服务
- customer-service (7002) - 客户管理服务
- acquisition-service (7003) - 获客服务
- operation-service (7004) - 运营管理服务
- asset-service (7005) - 素材管理服务
- message-service (7006) - 消息管理服务
- integration-service (7007) - 企微集成服务
- analytics-service (7008) - 数据分析服务
- finance-service (7009) - 财务管理服务

### 停止所有服务

停止所有运行中的后端服务。

```powershell
# 在项目根目录执行
.\scripts\run\stop-all-services.ps1

# 或使用 npm 命令
pnpm run stop:all
```

**功能特性：**
- ✅ 自动检测端口 7000-7009 上的进程
- ✅ 强制终止所有相关进程
- ✅ 显示终止进度和结果
- ✅ 安全处理，不影响其他进程

### 检查服务状态

检查所有服务的运行状态和健康度。

```powershell
# 在项目根目录执行
.\scripts\run\check-services.ps1

# 或使用 npm 命令
pnpm run check:services
```

**功能特性：**
- ✅ 检查端口占用情况
- ✅ 访问健康检查接口
- ✅ 显示每个服务的状态
- ✅ 汇总运行统计

## 🧪 测试脚本

测试相关脚本位于 `test/` 目录下，详见 [test/README.md](test/README.md)。

### 快速测试

```powershell
# 完整测试（编译 + 类型检查）
pnpm run test

# 仅编译测试
pnpm run test:build

# 仅类型检查
pnpm run test:type
```

## 🔌 Codex Superpowers（可选）

若使用 Codex 并希望启用 [Superpowers](https://github.com/obra/superpowers)，可在**本机终端**执行（需写入 `~/.codex`，IDE 沙箱无法代劳）：

```bash
bash code/scripts/install-superpowers-codex.sh
```

该脚本会：克隆 superpowers 到 `~/.codex/superpowers`、创建 `~/.codex/skills`、在 `~/.codex/AGENTS.md` 中加入 Superpowers 说明，并按官方 [INSTALL.md](https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.codex/INSTALL.md) 完成配置与校验。

## 💾 数据库脚本

### 初始化数据库（PostgreSQL）

推荐使用 Docker Compose：首次启动 `postgres` 容器并挂载空数据卷时，会自动执行 `scripts/init-db.pg.sql`。

手动执行（需本机 `psql` 且库已存在）：

```bash
PGPASSWORD=root123 psql -h localhost -U postgres -d scrm_dev -f scripts/init-db.pg.sql
```

说明：

- `scripts/init-db.pg.sql`：当前开发与初始化用的正式脚本。
- `scripts/init-db.sql`：历史 MySQL 脚本，仅作参考，**运行时勿使用**。

## 📊 监控配置

### Prometheus

Prometheus 配置文件：`prometheus.yml`

启动 Prometheus（使用 Docker）：

```bash
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/scripts/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

访问 Prometheus：http://localhost:9090

## 🔧 使用说明

### 1. 首次启动

```powershell
# 1. 启动数据库和中间件
docker-compose up -d

# 2. 数据库：首次 postgres 卷初始化会自动跑 init-db.pg.sql；否则见上文 psql 命令

# 3. 安装依赖
pnpm install

# 4. 启动所有服务
.\scripts\run\start-all-services.ps1
```

### 2. 日常开发

```powershell
# 方式1: 启动所有服务
pnpm run start:all

# 方式2: 只启动需要的服务（推荐）
pnpm run start:gateway      # API网关
pnpm run start:auth         # 认证服务
pnpm run start:customer     # 客户服务

# 检查状态
pnpm run check:services

# 运行测试
pnpm run test

# 停止服务
pnpm run stop:all
```

### 3. 开发特定功能

```powershell
# 开发客户管理功能
pnpm run start:gateway      # 启动网关
pnpm run start:auth         # 启动认证
pnpm run start:customer     # 启动客户服务

# 开发消息功能
pnpm run start:gateway      # 启动网关
pnpm run start:auth         # 启动认证
pnpm run start:message      # 启动消息服务
pnpm run start:integration  # 启动集成服务（如需企微消息）
```

## ⚠️ 注意事项

1. **端口占用**：启动前请确保端口 7000-7009 未被占用
2. **依赖服务**：确保 PostgreSQL、Redis 等依赖服务已启动
3. **环境配置**：检查 `.env` 文件是否正确配置
4. **权限问题**：Windows 上可能需要管理员权限
5. **防火墙**：确保防火墙允许这些端口的访问

## 🐛 故障排查

### 服务启动失败

1. 检查依赖是否安装：`pnpm install`
2. 检查端口是否被占用：`netstat -ano | findstr "7000"`
3. 检查数据库连接：查看 `.env` 配置
4. 查看服务日志：在服务窗口中查看错误信息

### 服务无法访问

1. 检查服务是否启动：`.\scripts\check-services.ps1`
2. 检查防火墙设置
3. 检查健康检查接口：`http://localhost:7001/health`

### 停止脚本无效

```powershell
# 手动查找并终止进程
netstat -ano | findstr "7001"
taskkill /PID <进程ID> /F
```

## 📝 相关文档

- [快速开始](../guides/快速开始.md)
- [测试说明](../tests/README.md)
- [开发指南](../development/)
- [API文档](../api/)

## 💡 提示

- 使用 `start-all-services.ps1` 时，每个服务会在独立窗口中启动，便于查看日志
- 可以关闭任意服务窗口来停止对应服务
- 建议使用 `check-services.ps1` 定期检查服务健康状态
- 开发时可以只启动需要的服务，无需全部启动
