# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

Open SCRM is a pnpm + Turborepo monorepo located in `/workspace/code/`. It contains:
- **10 backend microservices** (`services/`) using Midway.js 3.x (Koa-based) + TypeORM + MySQL + Redis
- **4 shared packages** (`packages/`) — must be built before services can run
- **4 frontend apps** (`apps/`) — stubs only (no source code yet)

### Infrastructure: Docker Services

MySQL 8.0 and Redis 7.0 are required. Start them from `/workspace/code`:
```bash
sudo dockerd &>/tmp/dockerd.log &  # if Docker daemon not running
sleep 3
sudo docker compose up -d mysql redis
```
Wait ~10s for MySQL to accept connections. The init-db.sql auto-creates the `scrm_dev` database and seeds the admin user.

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

1. **Port mapping**: All service ports are now standardized — see `code/docs/开发计划.md` for the definitive port table. gateway=7000, auth=7001, customer=7002, etc.

2. **DB credentials**: All services use `root/root123/scrm_dev` (matches docker-compose). When DB is fresh from docker-compose, tables from `init-db.sql` are auto-created.

3. **Default admin login**: username=`admin`, password=`Admin@123`.

4. **admin-platform frontend**: Run `cd code/apps/admin-platform && pnpm dev` (port 3001). Vite proxy forwards `/api` to gateway on port 7000.

5. **Chinese encoding in DB responses**: The `realName` field for the admin user shows garbled text in API responses due to mysql charset inheritance — this is cosmetic and doesn't affect functionality.

### Hello World Test

After starting auth-service:
```bash
curl -X POST http://localhost:7000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@123"}'
```
