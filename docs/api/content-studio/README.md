# Content Studio API 契约

经 `gateway-service` 转发，前缀 `/api/v1/content-studio/*`，目标服务 `content-generation-service`（7010）。

## 认证

与现有微服务一致：登录后 `Authorization: Bearer <JWT>`；租户头由 gateway / 中间件注入（`x-corp-id`、`x-user-id`）。

## 渠道枚举

与 `@scrm/shared-constants` 中 `CONTENT_CHANNEL` 一致：

- `short_video_script`
- `long_video_script`
- `wechat_article`
- `xhs_graphic`
- `tweet`
- `douyin_caption`

## 核心 API

### 创建内容源

```http
POST /api/v1/content-studio/sources
Content-Type: application/json

{
  "title": "核心主题",
  "body": "Markdown 正文",
  "summary": "可选摘要",
  "keywords": ["AI", "创作"],
  "tone": "专业",
  "targetAudience": "创作者",
  "kbEnabled": true,
  "kbQuery": "可选覆盖检索词"
}
```

### 触发生成

```http
POST /api/v1/content-studio/sources/:id/generate
Content-Type: application/json

{
  "channels": ["tweet", "xhs_graphic"],
  "kbEnabled": true,
  "kbQuery": "可选"
}
```

响应含 `jobId`；默认 Bull 异步（`status: pending`），设置 `CONTENT_GENERATION_SYNC=true` 时同步返回 `variants`。

### 查询任务

```http
GET /api/v1/content-studio/jobs/:id
```

### 推送草稿

```http
POST /api/v1/content-studio/variants/:id/push-draft
Content-Type: application/json

{
  "platform": "xiaohongshu",
  "accountId": 1,
  "contentType": 1
}
```

### 知识库代理

```http
GET /api/v1/content-studio/kb/health
POST /api/v1/content-studio/kb/search
```

## 发布（acquisition-service）

```http
POST /api/v1/acquisition/contents/:id/publish
GET /api/v1/acquisition/contents/:id/publish-status
POST /api/platform-account/:id/oauth
```

## E2E 验证

```bash
cd code
# 启动 gateway、auth、acquisition、content-generation、postgres、redis 后：
CONTENT_GENERATION_SYNC=true \
CONTENT_GENERATION_MOCK_LLM=true \
PLATFORM_PUBLISH_MODE=mock \
pnpm test:e2e:content-studio
```

详见 [本地启动与验证-ContentStudio.md](../../code/docs/harness/本地启动与验证-ContentStudio.md)。

---

**更新日期：** 2026-06-05
