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

1. **Port mapping inconsistency**: The README says gateway=7000, auth=7001, but the actual configs are **auth-service=7000, gateway-service=7001** (swapped). Always check `src/config/config.default.ts` for the real port.

2. **ESLint config issue**: `pnpm lint` fails because `.eslintrc.js` references `@vue/typescript/recommended` in Vue file overrides, but the `@vue/eslint-config-typescript` package is not installed. This is a pre-existing issue. TypeScript type-checking (`pnpm type-check`) works fine.

3. **Password hash mismatch**: The bcrypt hash in `scripts/init-db.sql` does not match the documented password `Admin@123`. To fix, update the DB directly:
   ```bash
   NEW_HASH=$(cd /workspace/code/services/auth-service && node -e "const bcrypt = require('bcrypt'); bcrypt.hash('Admin@123', 12).then(h => console.log(h))")
   sudo docker exec scrm-mysql mysql -u root -proot123 scrm_dev -e "UPDATE user SET password='$NEW_HASH' WHERE username='admin';"
   ```

4. **Service DB credential inconsistency**: `auth-service` uses `root/root123/scrm_dev` (matches docker-compose), but other services like `customer-service` use `scrm/scrm_password/scrm_customer` by default. For those services, set env vars or create the DB user/databases manually.

5. **Test scripts are PowerShell**: The `pnpm test` scripts in `package.json` use `.ps1` PowerShell scripts (`chcp 65001 && powershell ...`), which don't work on Linux. Run type-check and build directly instead: `pnpm type-check && pnpm build`.

### Hello World Test

After starting auth-service:
```bash
curl -X POST http://localhost:7000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@123"}'
```
