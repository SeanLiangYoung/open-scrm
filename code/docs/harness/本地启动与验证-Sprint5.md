# Sprint 5 — 本地启动与验证（一页纸）

## 1. 依赖服务

| 组件 | 说明 |
|------|------|
| gateway、auth、acquisition、integration | PostgreSQL + **Redis**（acquisition 幂等键） |
| 端口 | acquisition **7003**、integration **7007**（以 `docs/开发计划.md` 为准） |

## 2. 测试路由（integration）

- 本地 `NODE_ENV=local` 或 `development` 时**默认可用**（`NODE_ENV !== production`）。
- 若 integration 进程为 production，需在运行环境设置 **`ENABLE_INTEGRATION_TEST_ROUTES=1`** 后重启。
- **注意**：`e2e/run-sprint5-api.sh` 里 `export ENABLE_INTEGRATION_TEST_ROUTES=1` **只影响脚本子进程**，不注入已启动的容器；Docker 场景请在 compose 或 K8s 为 **integration-service** 配环境变量。

## 3. 命令（在 `code/`）

```bash
pnpm test:e2e:sprint5
```

## 4. 运营端（§7.3）

1. `pnpm dev` 启动 **operation-platform**（默认 **3003**）。
2. 登录 → **获客 / 渠道活码**（路由 `channels`）。
3. 新建活码；列表应展示；`扫码次数` 可通过 API 联调后刷新验证。

## 5. 手动 API 顺序示例

1. `POST /api/v1/auth/login` → `accessToken`  
2. `POST /api/v1/acquisition/channel-codes` body `{ "codeName": "测试", "channel": "douyin" }`  
3. `POST /api/v1/integration/test/acquisition-channel-scan` body `{ "channelCodeId": <id>, "externalEventId": "可选" }`  
4. `GET /api/v1/acquisition/channel-codes/<id>` → `scanCount` 递增；相同 `externalEventId` 第二次 `replayed: true`
