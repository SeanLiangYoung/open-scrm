# @scrm/e2e

Playwright 端到端测试（按 Sprint 分文件）。

## 完整 E2E（推荐）

在 **`code/`** 目录执行（脚本会：检查网关 → 释放 3001/3003 → 启动两个 Vite → `wait-on` → 安装 Chromium（若缺）→ 跑全部用例）：

```bash
pnpm test:e2e
```

**前置**：后端网关可达（Docker 映射一般为 **`http://127.0.0.1:17000`**）。可通过环境变量覆盖：

```bash
GATEWAY_URL=http://127.0.0.1:17000 pnpm test:e2e
```

仅 API（不经浏览器）：

```bash
pnpm test:e2e:api
```

仅 Playwright（需已自行启动网关 + 两个前端，且 `VITE_GATEWAY_URL` 指向网关）：

```bash
pnpm test:e2e:playwright
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `GATEWAY_URL` | 网关根地址，默认 `http://127.0.0.1:17000` |
| `ADMIN_BASE_URL` | 管理端，默认 `http://localhost:3001` |
| `OPERATION_BASE_URL` | 运营端，默认 `http://localhost:3003` |

## 手动安装浏览器

若跳过 `pnpm test:e2e` 脚本、直接跑 `playwright test`，需先：

```bash
pnpm --filter @scrm/e2e exec playwright install chromium
```
