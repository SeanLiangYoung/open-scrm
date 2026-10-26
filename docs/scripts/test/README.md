# 测试脚本说明

当前可重复入口为 `node scripts/test/verify-reliability.cjs --group all --report-dir /tmp/scrm-verification-new`（在code目录执行）。支持static/browser/database/http四组，按当前注册阶段串行，保存JSON清单和逐阶段日志，任何失败或依赖缺失跳过都返回非零。不会自动安装依赖。数据库/HTTP组仅创建专用临时资源；五服务boot显式使用无真实凭据的OSS夹具。参见[统一验收说明](../../tests/2026-10-26-unified-verification-runner.md)及[最新证据](../../tests/2026-10-26-overnight-verification.md)。

`code/scripts/test/full-test.sh` 为每个门禁保留独立日志，并在失败时显示退出码及最后 30 行输出。默认日志位于临时目录 `scrm-full-test.*`；可通过 `TEST_REPORT_DIR=/absolute/path` 指定保存目录。脚本继续运行后续门禁以收集完整结果，有任何失败最终返回非零。

本目录包含SCRM系统的所有测试脚本。

---

## 📝 脚本列表

### 1. build-test.ps1

**功能**: 测试所有包和服务的编译构建

**使用方式**:
```powershell
# 基本测试
.\scripts\test\build-test.ps1

# 详细输出（显示错误详情）
.\scripts\test\build-test.ps1 -Verbose
```

**测试内容**:
- 所有共享包的TypeScript编译
- 所有微服务的Midway.js构建

---

### 2. type-check.ps1

**功能**: 测试所有包和服务的TypeScript类型检查

**使用方式**:
```powershell
# 基本测试
.\scripts\test\type-check.ps1

# 详细输出
.\scripts\test\type-check.ps1 -Verbose
```

**测试内容**:
- TypeScript严格模式类型检查
- 验证类型定义完整性

---

### 3. full-test.ps1

**功能**: 执行完整测试套件并生成测试报告

**使用方式**:
```powershell
# 执行完整测试
.\scripts\test\full-test.ps1

# 执行测试并生成报告
.\scripts\test\full-test.ps1 -GenerateReport

# 详细输出并生成报告
.\scripts\test\full-test.ps1 -Verbose -GenerateReport
```

**测试内容**:
- 构建测试
- 类型检查
- 构建产物验证

**测试报告**: 生成到 `docs/tests/test-report-{timestamp}.md`

---

## 🚀 快速开始

### 日常开发测试

```powershell
# 快速检查类型错误
.\scripts\test\type-check.ps1

# 快速检查编译错误
.\scripts\test\build-test.ps1
```

### 提交前测试

```powershell
# 完整测试
.\scripts\test\full-test.ps1
```

### 生成测试报告

```powershell
# 生成带时间戳的测试报告
.\scripts\test\full-test.ps1 -GenerateReport
```

---

## 📊 测试报告

测试报告自动生成到 `docs/tests/` 目录，命名格式：

```
test-report-yyyyMMdd-HHmmss.md
```

例如：
- `test-report-20251028-143522.md`

---

## 🔧 集成到开发流程

### 在package.json中使用

```json
{
  "scripts": {
    "test": "pwsh -File ./scripts/test/full-test.ps1",
    "test:build": "pwsh -File ./scripts/test/build-test.ps1",
    "test:type": "pwsh -File ./scripts/test/type-check.ps1",
    "test:report": "pwsh -File ./scripts/test/full-test.ps1 -GenerateReport"
  }
}
```

### 在CI/CD中使用

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pwsh -File ./scripts/test/full-test.ps1 -GenerateReport
      - uses: actions/upload-artifact@v3
        with:
          name: test-report
          path: docs/tests/
```

---

## 📋 测试检查清单

### 提交代码前

- [ ] 运行 `build-test.ps1` 确保编译通过
- [ ] 运行 `type-check.ps1` 确保类型正确
- [ ] 运行 `full-test.ps1` 确保所有测试通过

### 发布版本前

- [ ] 运行完整测试并生成报告
- [ ] 检查测试报告，确保100%通过
- [ ] 归档测试报告

---

## 🐛 故障排查

### 测试失败

1. 查看详细输出：`-Verbose` 参数
2. 检查特定包：直接进入包目录运行 `pnpm build`
3. 清理重试：删除 `dist` 和 `node_modules`，重新安装

### 脚本无法执行

```powershell
# 设置执行策略（首次使用）
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## 📞 支持

如有问题，请查看：
- 主项目 README：`../../../README.md`
- 快速开始：`../guides/快速开始.md`
- 开发计划：`../开发计划.md`

---

**最后更新**: 2025-10-28

