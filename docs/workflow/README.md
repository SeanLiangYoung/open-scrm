# 协作与工作流（人在流程）

本目录收录**多人协同、分支与 PR、工程纪律、合并后更新环境**等约定，与产品能力事实源分层维护：产品与运行时事实以本仓库根目录 `docs/`、`skills/` 与实现代码为准。

## 文档索引


| 文档 | 内容 |
| ------------------------------------------------ | ---------------------------------------- |
| [engineering-principles.md](./engineering-principles.md) | 工程契约与 AI 辅助开发原则（通用模式） |
| [team-collaboration.md](./team-collaboration.md) | 多人角色、异步协作、冲突预防、与契约 Owner 的配合 |
| [git-and-review.md](./git-and-review.md) | 功能分支、本地开发、PR、合并前自检与评审 |
| [ci-cd-development.md](./ci-cd-development.md) | PR 合并后 CI → 环境；只讲治理意图，不承载产品事实 |
| [local-environment.md](./local-environment.md) | 本地与团队约定对齐：运行时版本、自检命令、可选 Dev Container 等 |


## 与别处文档的关系


| 主题 | 说明 |
| --------- | --------------------------------------- |
| 仓库结构与事实源 | 见 [`docs/README.md`](../README.md) |
| Studio 运行契约 | 见 [`docs/facts/studio.md`](../facts/studio.md) |
| Cursor 规则 | [.cursor/rules/docs-first-workflow.mdc](../../.cursor/rules/docs-first-workflow.mdc) |
