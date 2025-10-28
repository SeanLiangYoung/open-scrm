# Run Scripts 运行脚本目录

本目录包含所有服务运行相关的脚本。

## 📁 目录结构

```
run/
├── start-all-services.ps1    # 启动所有后端服务
├── stop-all-services.ps1     # 停止所有后端服务
├── check-services.ps1        # 检查服务状态
├── start-gateway.ps1         # 启动网关服务 (7001)
├── start-auth.ps1            # 启动认证服务 (7000)
├── start-customer.ps1        # 启动客户服务 (7002)
├── start-acquisition.ps1     # 启动获客服务 (7003)
├── start-operation.ps1       # 启动运营服务 (7004)
├── start-asset.ps1           # 启动素材服务 (7005)
├── start-message.ps1         # 启动消息服务 (7006)
├── start-integration.ps1     # 启动集成服务 (7007)
├── start-analytics.ps1       # 启动分析服务 (7008)
├── start-finance.ps1         # 启动财务服务 (7009)
└── README.md                 # 本文件
```

## 🚀 快速开始

### 启动所有服务
```bash
pnpm run start:all
```

### 启动单个服务
```bash
pnpm run start:gateway      # API网关 (7001)
pnpm run start:auth         # 认证服务 (7000)
pnpm run start:customer     # 客户服务 (7002)
pnpm run start:acquisition  # 获客服务 (7003)
pnpm run start:operation    # 运营服务 (7004)
pnpm run start:asset        # 素材服务 (7005)
pnpm run start:message      # 消息服务 (7006)
pnpm run start:integration  # 集成服务 (7007)
pnpm run start:analytics    # 分析服务 (7008)
pnpm run start:finance      # 财务服务 (7009)
```

### 停止所有服务
```bash
pnpm run stop:all
```

### 检查服务状态
```bash
pnpm run check:services
```

## 📋 服务端口对照表

| 服务 | 端口 | 脚本 | 快捷命令 |
|------|------|------|----------|
| 认证服务 | 7000 | start-auth.ps1 | `pnpm run start:auth` |
| API网关 | 7001 | start-gateway.ps1 | `pnpm run start:gateway` |
| 客户服务 | 7002 | start-customer.ps1 | `pnpm run start:customer` |
| 获客服务 | 7003 | start-acquisition.ps1 | `pnpm run start:acquisition` |
| 运营服务 | 7004 | start-operation.ps1 | `pnpm run start:operation` |
| 素材服务 | 7005 | start-asset.ps1 | `pnpm run start:asset` |
| 消息服务 | 7006 | start-message.ps1 | `pnpm run start:message` |
| 集成服务 | 7007 | start-integration.ps1 | `pnpm run start:integration` |
| 分析服务 | 7008 | start-analytics.ps1 | `pnpm run start:analytics` |
| 财务服务 | 7009 | start-finance.ps1 | `pnpm run start:finance` |

## 💡 使用技巧

### 1. 开发特定功能时只启动相关服务

```bash
# 开发客户管理功能
pnpm run start:gateway      # 网关（必需）
pnpm run start:auth         # 认证（必需）
pnpm run start:customer     # 客户服务

# 开发运营功能
pnpm run start:gateway
pnpm run start:auth
pnpm run start:customer
pnpm run start:operation
pnpm run start:message
```

### 2. 直接执行脚本

```powershell
# 在项目根目录执行
.\scripts\run\start-all-services.ps1
.\scripts\run\stop-all-services.ps1
.\scripts\run\check-services.ps1

# 或进入目录执行
cd scripts\run
.\start-gateway.ps1
.\start-auth.ps1
```

### 3. 在新窗口中启动

start-all-services.ps1 会为每个服务打开独立窗口，便于：
- 查看每个服务的日志
- 单独重启某个服务（关闭窗口即停止）
- 并行运行多个服务

## ⚙️ 脚本工作原理

### 单服务启动脚本（如 start-gateway.ps1）

```powershell
# 1. 设置错误处理
$ErrorActionPreference = "Stop"

# 2. 定位服务目录
$ServicePath = "services/gateway-service"

# 3. 切换到服务目录
Push-Location $ServicePath

# 4. 启动开发服务器
pnpm dev
```

### start-all-services.ps1

1. 检查 pnpm 是否安装
2. 检查依赖是否已安装
3. 为每个服务打开独立的 PowerShell 窗口
4. 在每个窗口中执行 `pnpm dev`

### stop-all-services.ps1

1. 扫描端口 7000-7009
2. 查找占用这些端口的进程
3. 强制终止这些进程

### check-services.ps1

1. 检查每个端口是否被占用
2. 访问 `/health` 接口验证服务健康状态
3. 输出状态汇总

## 🔍 故障排查

### 问题1: 脚本执行失败

```powershell
# 确保执行策略允许运行脚本
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 或使用 Bypass 参数
powershell -ExecutionPolicy Bypass -File .\scripts\run\start-gateway.ps1
```

### 问题2: 端口被占用

```bash
# 停止所有服务
pnpm run stop:all

# 手动检查端口
netstat -ano | findstr "7001"

# 手动终止进程
taskkill /PID <进程ID> /F
```

### 问题3: 服务启动失败

1. 检查 `.env` 配置文件
2. 确认数据库已启动
3. 确认 Redis 已启动
4. 查看服务窗口的错误日志

## 📝 相关文档

- [完整脚本文档](../README.md)
- [环境配置说明](../../环境配置说明.md)
- [快速开始指南](../../快速开始.md)
- [脚本命令速查](../../脚本命令速查.md)

