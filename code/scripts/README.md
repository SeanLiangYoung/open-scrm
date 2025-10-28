# 脚本和工具

本目录包含SCRM系统的所有脚本和工具。

---

## 📁 目录结构

```
scripts/
├── test/                   # 测试脚本
│   ├── build-test.ps1      # 构建测试
│   ├── type-check.ps1      # 类型检查
│   ├── full-test.ps1       # 完整测试
│   └── README.md           # 测试脚本说明
│
├── init-db.sql             # 数据库初始化
├── prometheus.yml          # Prometheus配置
└── README.md               # 本文件
```

---

## 📝 脚本分类

### 1. 测试脚本 (`test/`)

所有测试相关的PowerShell脚本。

**查看详情**: [test/README.md](./test/README.md)

**快速使用**:
```bash
# 完整测试并生成报告
pnpm test:report

# 仅构建测试
pnpm test:build

# 仅类型检查
pnpm test:type
```

---

## 📝 脚本列表

### test-all.ps1 / test-all.sh

**功能**: 完整测试所有包和服务的编译和类型检查

**使用方式**:

```bash
# Windows (PowerShell)
.\scripts\test-all.ps1

# Linux/Mac
chmod +x scripts/test-all.sh
./scripts/test-all.sh
```

**测试内容**:
- 所有共享包的构建和类型检查
- 所有微服务的构建和类型检查
- 生成测试报告

**输出示例**:
```
========================================
  SCRM System - Full Test Script
========================================

=== Testing Shared Packages ===

[Testing] shared-types
  [OK] Build passed
  [OK] Type check passed

...

========================================
  Test Summary
========================================

Success: 12
Failed:  0

All tests passed! ✓
```

---

### init-db.sql

**功能**: 数据库初始化脚本

**使用场景**: Docker Compose自动执行或手动初始化数据库

**包含内容**:
- 数据库表结构创建
- 默认管理员账号
- 默认角色数据

---

### prometheus.yml

**功能**: Prometheus监控配置

**使用场景**: 监控微服务运行状态

---

## 🔧 快速测试命令

### 测试单个包

```bash
# 测试shared-types
cd packages/shared-types
pnpm build
pnpm type-check

# 测试gateway-service
cd services/gateway-service
pnpm build
pnpm type-check
```

### 测试所有包

```bash
# 使用pnpm workspace
cd code
pnpm --filter "@scrm/shared-*" build
pnpm --filter "@scrm/shared-*" type-check
```

### 清理构建产物

```bash
# Windows
Get-ChildItem -Path packages,services -Recurse -Directory -Filter dist | Remove-Item -Recurse -Force

# Linux/Mac
find packages services -type d -name "dist" -exec rm -rf {} +
```

---

## 📊 测试报告

测试脚本执行后，可以查看以下报告：

- `../测试报告.md` - 初始测试报告
- `../完整测试报告.md` - 完整详细测试报告
- `../测试总结-简明版.md` - 简明测试总结

---

## 🚀 持续集成

这些脚本可以集成到CI/CD流程中：

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: ./scripts/test-all.sh
```

---

**最后更新**: 2025-10-28

