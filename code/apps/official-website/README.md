# @scrm/official-website

Sprint 6 交付物 **A**：最小可运行官网（Vite + Vue 3），含首页导航与静态说明，**无 Nuxt**（与 `docs/apps/official-website` 中长期愿景文档区分）。

## 命令

```bash
pnpm dev      # http://127.0.0.1:3010
pnpm build    # 输出 dist/
pnpm preview  # 预览生产构建
```

## 部署

将 `pnpm build` 生成的 `dist/` 置于任意静态站点托管（Nginx、OSS、Netlify 等）。无需 Node 运行时。

## 与网关

营销页若需调 API，请将 `fetch` 基址指向部署环境的网关 URL（参见 `code/docs/facts/gateway-routes.md`）。
