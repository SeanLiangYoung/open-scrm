# Sprint 2 — 企微集成底座 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 交付可验证的企微集成底座切片：健康检查含 Redis、回调验签与消息体解密可单测、E2E 与契约一致。

**Architecture:** 将企微加解密与 SHA1 验签抽成 `src/util/wework-msg-crypt.util.ts`（纯函数，Node `crypto`）；`WeworkApiService` 仅委托；`IntegrationApiController.health` 聚合 DB + Redis 状态。

**Tech stack:** Midway 3、Vitest、Playwright、PostgreSQL、Redis。

---

## Task 1: 验签纯函数单测（RED → GREEN）

**Files:**
- Create: `services/integration-service/src/util/wework-msg-crypt.util.ts`
- Create: `services/integration-service/src/util/wework-msg-crypt.util.spec.ts`

**Steps:** 先写 `verifyWeworkCallbackSignature` 的用例（已知 token/timestamp/nonce 与期望 SHA1），再实现函数至通过。

## Task 2: 加解密对拍单测

**Steps:** 实现 `encryptWeworkMessage`（与企微文档一致的打包与 PKCS7）+ `decryptWeworkMessage`；测试「加密 → 解密」得原文；错误 corpId 应抛错。

## Task 3: 服务层委托

**Modify:** `services/integration-service/src/service/wework-api.service.ts` — `verifyCallbackMsgSignature`（企微四参验签）、`decryptMessage` 调用 util。

## Task 4: Health 含 Redis

**Modify:** `services/integration-service/src/controller/integration-api.controller.ts` — 注入 `RedisService`，探测后返回 `redis: connected|disconnected`。

## Task 5: Vitest 与根脚本

**Modify:** `services/integration-service/package.json`、`vitest.config.ts`、`code/package.json` 的 `test:unit`、`scripts/test/full-test.sh` 文案。

## Task 6: E2E 对齐

**Modify:** `code/e2e/tests/sprint2-integration.spec.ts` — `toMatchObject` 含 `redis: 'connected'`。

## Task 7: 文档与进度

**Modify:** `code/docs/harness/迭代进度总览.md`、`README.md` 索引。
