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

## 路径编号与批推归属（2026-10-26）

source/variant相关读写、compose/generate/push及job读取路径仅接受规范十进制正安全整数；指数、hex、尾字符、前导零、非正或超安全编号400，不再Number宽松转换。保留现有number调用契约，MAX_SAFE可用，不缩为int4；不声明新增超安全bigint路径能力。

批推按企业过滤后精确比较PG bigint水合sourceId字符串，合法本企匹配不再因string/number误拒绝；错源/外企仍逐项失败，不改变逐项处理语义。新增114回归、全服务148单元和tsc通过；隔离PG16六组用真实水合及本地安全草稿桩验证，0外部请求，4源/4变体/2本地链接，清理确认。未运行真实Wiki/LLM/acquisition或HTTP。详见[专属验证报告](../../tests/2026-10-26-content-studio-identifiers.md)。
