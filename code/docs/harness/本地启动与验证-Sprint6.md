# Sprint 6 — 本地启动与验证

## 前置

- 网关 `/health` 可达（默认 `http://127.0.0.1:17000`，与 E2E 一致）。
- 获客 API 依赖：`gateway`、`auth`、`acquisition`（及 DB）；运营端「新建活码」经 Vite 代理走网关。

## 官网（流程 B · 选 A）

```bash
cd code
pnpm install
pnpm --filter @scrm/official-website dev
```

浏览器打开 `http://127.0.0.1:3010`，应见标题「Open SCRM — 企业私域运营」与主导航。

生产构建：

```bash
pnpm --filter @scrm/official-website build
```

产物在 `apps/official-website/dist/`。

## 全量 E2E（含官网 + 运营新建活码）

```bash
cd code
pnpm test:e2e
```

脚本会释放 `3001` / `3003` / `3010` 占用端口后启动三个 dev 服务，再执行 Playwright 全部 project。

## 仅官网 Playwright

```bash
# 终端 1
pnpm --filter @scrm/official-website dev
# 终端 2（code/）
pnpm test:e2e:sprint6-official
```

## 路由表审查（流程 C）

打开 [../facts/gateway-routes.md](../facts/gateway-routes.md)，与 `services/gateway-service/src/config/config.default.ts` 中 `gateway.routes` 逐项对照。
