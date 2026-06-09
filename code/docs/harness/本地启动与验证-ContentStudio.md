# 本地启动与验证 — Content Studio（创作中心）

端到端验证「核心内容源 → 多平台生成 → 推送草稿 → 发布」API 闭环。事实源见 [docs/facts/studio.md](../../../docs/facts/studio.md)。

## 依赖服务

| 服务 | 端口 | 说明 |
|------|------|------|
| gateway-service | 7000（Compose 宿主机 17000） | API 入口 |
| auth-service | 7001 | 登录 JWT |
| acquisition-service | 7003 | 草稿与发布 |
| content-generation-service | 7010 | 内容工坊 |
| PostgreSQL | 5432 | 含 `content_*` 表 |
| Redis | 6379 | Bull 队列（异步生成） |

## 推荐环境变量（content-generation-service）

```env
CONTENT_GENERATION_SYNC=true
CONTENT_GENERATION_MOCK_LLM=true
PLATFORM_PUBLISH_MODE=mock
XHS_PUBLISH_MODE=mock
ACQUISITION_SERVICE_URL=http://localhost:7003
```

- **SYNC**：E2E 与本地调试时同步返回 variants，避免 Bull 轮询不稳定。
- **MOCK_LLM**：不调用真实 LLM API，返回固定 JSON。
- **MOCK publish**：各平台发布返回 `*-mock-*` 平台 ID。

可选 llm-wiki（KB grounding 联调）：

```bash
# 在 code/ 目录复制模板并填入 Token（勿提交 .env）
cp env.example .env
# 编辑 LLM_WIKI_API_TOKEN=...
```

`content-generation-service` 启动时会自动加载 `code/.env`（见 `load-monorepo-env.cjs`）。

```env
LLM_WIKI_BASE_URL=http://127.0.0.1:19828
LLM_WIKI_API_TOKEN=<App 内生成的 Token>
LLM_WIKI_PROJECT_ID=current
```

## 启动顺序（本地 mw dev）

1. `docker compose up -d postgres redis`
2. `cd services/auth-service && NODE_ENV=development npx mw dev`
3. `cd services/acquisition-service && NODE_ENV=development npx mw dev`
4. `cd services/content-generation-service && CONTENT_GENERATION_SYNC=true CONTENT_GENERATION_MOCK_LLM=true NODE_ENV=development npx mw dev`
5. `cd services/gateway-service && NODE_ENV=development npx mw dev`

## 运行 E2E

```bash
cd code
GATEWAY_URL=http://127.0.0.1:7000 pnpm test:e2e:content-studio
# Docker Compose 网关：
GATEWAY_URL=http://127.0.0.1:17000 pnpm test:e2e:content-studio
```

Playwright 用例：`code/e2e/tests/content-studio.spec.ts`。

## 手工 curl 片段

```bash
TOKEN=$(curl -s -X POST "$GATEWAY/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@123"}' | jq -r .accessToken)

curl -s -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"测试","body":"正文"}' \
  "$GATEWAY/api/v1/content-studio/sources"
```

---

**更新日期：** 2026-06-05
