# AGENTS.md

本页包含两类内容：**协作入口与规范索引**（面向 Agent 导航），以及 **Cursor Cloud / 本地开发** 的运行说明。

## 协作入口

本段只做 Agent 导航，不承载产品规范正文。

### Canonical Sources

- **仓库事实源索引**：[`docs/README.md`](docs/README.md)
- **网站生成 skill**：[`skills/website-generator/SKILL.md`](skills/website-generator/SKILL.md)
- **HTML 编辑 skill**：[`skills/html-editing/SKILL.md`](skills/html-editing/SKILL.md)
- **Studio 运行契约**：[`docs/facts/studio.md`](docs/facts/studio.md)
- **示例 / 输出语义**：[`docs/facts/examples-and-output.md`](docs/facts/examples-and-output.md)
- **Harness 治理层**：[`docs/workflow/README.md`](docs/workflow/README.md)

### Compatibility Paths

- [`.cursor/skills/html-editing/SKILL.md`](.cursor/skills/html-editing/SKILL.md)：编辑网站 skill 的兼容副本

### 通用约定

- [文档优先与文档同步](.cursor/rules/docs-first-workflow.mdc)
- [工程契约与一致性](.cursor/rules/engineering-contracts.mdc)

---

## Cursor Cloud specific instructions

### Project Overview

Open SCRM is a pnpm + Turborepo monorepo located in `/workspace/code/`. It contains:
- **10 backend microservices** (`services/`) using Midway.js 3.x (Koa-based) + TypeORM + PostgreSQL + Redis
- **4 shared packages** (`packages/`) — must be built before services can run
- **4 frontend apps** (`apps/`) — stubs only (no source code yet)

### Infrastructure: Docker Services

PostgreSQL 16 and Redis 7.0 are required. Start them from `/workspace/code`:
```bash
sudo dockerd &>/tmp/dockerd.log &  # if Docker daemon not running
sleep 3
sudo docker compose up -d postgres redis
```
Wait until PostgreSQL accepts connections. `scripts/init-db.pg.sql` runs on first container init and seeds the `scrm_dev` database (including the admin user).

### Building & Running

Standard commands (from `/workspace/code`):
```bash
pnpm install              # install all deps
pnpm build                # build all packages + services (turbo)
pnpm type-check           # TypeScript type checking (turbo)
```

To start individual services:
```bash
cd services/auth-service && NODE_ENV=development npx mw dev    # port 7000
cd services/gateway-service && NODE_ENV=development npx mw dev # port 7001
```

### Known Gotchas

1. **Port mapping**: All service ports are now standardized — see `docs/开发计划.md` for the definitive port table. gateway=7000, auth=7001, customer=7002, etc.

2. **DB credentials**: Docker Compose uses `postgres/root123` against database `scrm_dev` (see `code/docker-compose.yml`). Override with `DB_HOST`, `DB_PORT` (default `5432`), `DB_USERNAME` / `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`. Fresh volumes apply `code/scripts/init-db.pg.sql` once.

3. **Default admin login**: username=`admin`, password=`Admin@123`.

4. **admin-platform frontend**: Run `cd code/apps/admin-platform && pnpm dev` (port 3001). Vite proxy forwards `/api` to gateway on port 7000.

5. **Legacy MySQL**: The repo previously used MySQL; `scripts/init-db.sql` is retained for reference only. Runtime DB is PostgreSQL.

### Hello World Test

After starting auth-service:
```bash
curl -X POST http://localhost:7000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@123"}'
```
