# Studio 运行契约 — AI 原生创作中心

> **状态：** 草案（与实现同步中）  
> **关联计划：** [多平台内容生成服务](../plans/2026-06-04-content-generation-service.md) · [AI 原生个人创作中心](../plans/2026-06-05-ai-native-creation-center.md)

## 三层架构

| 层 | 组件 | 端口/位置 | 职责 |
|----|------|-----------|------|
| 知识层 | LLM Wiki 桌面 App | `127.0.0.1:19828` | wiki 检索、读页、图谱 |
| 核心层 | `content-generation-service` | `7010` | 核心内容源、KB grounding、多渠道生成 |
| 外围层 | `acquisition-service` | `7003` | 草稿 CRUD、平台 OAuth token、发布 |

入口 UI：`admin-platform` → **内容工坊**（`/content-studio`）。

## 本地依赖

1. **LLM Wiki App 运行**，且 Settings → API + MCP 已生成 Token
2. **PostgreSQL + Redis**（docker compose）
3. **Gateway** `7000` 路由：
   - `/api/v1/content-studio/*` → 7010
   - `/api/v1/acquisition/*` → 7003

## 环境变量

| 变量 | 服务 | 说明 |
|------|------|------|
| `LLM_WIKI_BASE_URL` | content-generation | 默认 `http://127.0.0.1:19828` |
| `LLM_WIKI_API_TOKEN` | content-generation | llm-wiki Bearer Token |
| `LLM_WIKI_PROJECT_ID` | content-generation | 默认 `current` |
| `LLM_API_BASE` / `LLM_API_KEY` / `LLM_MODEL` | content-generation | OpenAI 兼容生成端点 |
| `ACQUISITION_SERVICE_URL` | content-generation | push-draft 内部调用 |
| `XHS_PUBLISH_MODE` | acquisition | `mock`（默认）或 `live` |
| `PLATFORM_PUBLISH_MODE` | acquisition | 抖音/微信/X mock 发布 |
| `CONTENT_GENERATION_SYNC` | content-generation | `true` 时跳过 Bull，同步生成 |
| `CONTENT_GENERATION_MOCK_LLM` | content-generation | `true` 时 E2E/本地不调用真实 LLM |

Docker 内 CGS 访问宿主机 llm-wiki 时使用 `http://host.docker.internal:19828`。

## 创作流水线

```mermaid
sequenceDiagram
  participant UI as admin_platform
  participant CGS as content_generation_7010
  participant Wiki as llm_wiki_19828
  participant ACQ as acquisition_7003

  UI->>CGS: POST sources/:id/generate
  CGS->>Wiki: POST search (optional grounding)
  CGS->>CGS: LLM per channel
  UI->>CGS: POST variants/:id/push-draft
  CGS->>ACQ: POST contents (status=0)
  UI->>ACQ: POST platform-account/:id/oauth (dev token)
  UI->>ACQ: POST contents/:id/publish
  ACQ->>ACQ: XhsPublisher mock/live
```

## 内容状态（acquisition.content.status）

| 值 | 含义 |
|----|------|
| `0` | 草稿 |
| `1` | 已发布 |
| `2` | 失败 |
| `3` | 发布中 |

## 关键 API

### 内容工坊（经 gateway）

- `GET/POST/PATCH/DELETE /api/v1/content-studio/sources`
- `POST /api/v1/content-studio/sources/:id/generate`
- `GET /api/v1/content-studio/kb/health`
- `POST /api/v1/content-studio/kb/search`
- `POST /api/v1/content-studio/variants/:id/push-draft`

### 获客 / 发布

- `POST/GET /api/v1/acquisition/contents`
- `POST /api/v1/acquisition/contents/:id/publish`
- `GET /api/v1/acquisition/contents/:id/publish-status`
- `POST /api/platform-account/:id/oauth` — 本地开发写入 access token

## 失败模式

| 现象 | 原因 | 处理 |
|------|------|------|
| KB 503 / 检索空 | llm-wiki 未运行或未配 Token | 启动 App；设置 `LLM_WIKI_API_TOKEN` |
| 生成失败 | LLM 端点/Key 无效 | 检查 `LLM_*` |
| 发布 401 | 平台账号无 token | 推送前调用 oauth 或 UI 填 Token |
| `XHS live publish is not configured` | `XHS_PUBLISH_MODE=live` 但未接 Open API | 本地用 `mock` |

## 验证命令（示例）

```bash
# KB 健康
curl -s http://127.0.0.1:19828/api/v1/health

# 经 gateway 创建核心源（需登录 Token）
curl -s -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试","body":"正文","kbEnabled":true}' \
  http://localhost:7000/api/v1/content-studio/sources
```

---

**更新日期：** 2026-06-05
