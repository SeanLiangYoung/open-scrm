# 测试脚本说明

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
- 主项目README: `../../README.md`
- 快速开始指南: `../../快速开始.md`
- 开发计划: `../../../开发计划表.md`

---

**最后更新**: 2025-10-28

