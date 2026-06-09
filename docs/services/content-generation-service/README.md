# content-generation-service

端口 **7010**。内容工坊核心服务：内容源 CRUD、llm-wiki 检索代理、多平台 LLM 生成、变体推送 acquisition 草稿。

## 环境变量

| 变量 | 说明 |
|------|------|
| `LLM_API_BASE` | OpenAI 兼容 API Base URL |
| `LLM_API_KEY` | LLM API Key |
| `LLM_MODEL` | 默认模型 |
| `CONTENT_PROMPT_VERSION` | Prompt 版本标记 |
| `ACQUISITION_SERVICE_URL` | acquisition 内部 URL（push-draft） |
| `LLM_WIKI_BASE_URL` | 默认 `http://127.0.0.1:19828` |
| `LLM_WIKI_API_TOKEN` | llm-wiki API Token |
| `LLM_WIKI_PROJECT_ID` | 默认 `current` |

## API（经 gateway `/api/v1/content-studio/*`）

见 [多平台内容生成服务计划](../../plans/2026-06-04-content-generation-service.md) 与 [AI 原生创作中心计划](../../plans/2026-06-05-ai-native-creation-center.md)。

## 测试

```bash
cd code/services/content-generation-service && pnpm test
```
