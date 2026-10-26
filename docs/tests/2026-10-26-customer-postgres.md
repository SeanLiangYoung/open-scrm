# Customer follow-up PostgreSQL 16 integration verification

## Scope

2026-10-25 overnight batch for the 2026-10-26 handoff. This verifies the current follow-up controller using real TypeORM repositories and a disposable **PostgreSQL 16.13** database. It does not start HTTP services, authenticate a gateway request, or verify deployment network boundaries.

## Reproduce

From the repository root, with dependencies already installed and Docker running:

```bash
code/scripts/test/overnight-customer-postgres.sh
```

The `postgres:16-alpine` image must already be available locally; the harness does not download images. The script uses loopback port 15436 by default; choose another free port with `OVERNIGHT_PG_PORT=15437`. An occupied port causes failure without touching the existing listener.

The script creates a uniquely named `open-scrm-overnight-pg-<pid>` container, a dedicated `overnight_customer` database, and disposable credentials. It runs the full [`init-db.pg.sql`](../../code/scripts/init-db.pg.sql), then the [`follow-up migration`](../../code/scripts/migrations/2026-10-25-customer-follow-up.pg.sql) twice with SQL errors fatal. The container has no bind mounts, named volumes, or connection to project databases. EXIT / INT / TERM cleanup removes only the container ID successfully created by this run. It does not reuse or stop existing containers. Hard termination (SIGKILL or host failure) cannot run shell cleanup; any leftover container carries label `open-scrm.verification=overnight-customer` for inspection.

The companion `.cjs` runner loads current customer-service TypeScript sources in memory using the installed TypeScript compiler, so no generated `dist` files or root manifest changes are required. Node runs in UTC for reproducible timestamp checks. Database synchronization is disabled; schema comes exclusively from the SQL scripts.

## Observed result

The command passed **24 named checks** on PostgreSQL **16.13 aarch64 Alpine**, including:

- PostgreSQL major-version assertion, follow-up column types, and expected composite index after initialization and two idempotent migration passes.
- Actual persisted tenant and operator identity ignoring forged body identity; null next-follow time and default follow type.
- Valid leap-day UTC timestamp and supported follow type persisted and read through TypeORM.
- Separate tenant's normal creation; tenant-filtered listing against an intentionally inconsistent legacy record carrying another tenant's ID but the same customer key.
- Pagination size and total, cross-tenant writes and reads returning 404 in both tenant directions, and missing customer returning 404.
- Missing identity returning 401; authenticated-context fallback listing the owned records.
- Invalid body, content, follow type, calendar date, integer syntax, repeated/array ID, oversized page size, and unsafe offset returning 400.
- Exact final follow-up count **4**: two tenant-A records, one normal tenant-B record, and one deliberate tenant-B isolation fixture. Rejected requests added no records. Two customer fixtures were created; initialization may seed other business tables.

The script emitted expected `already exists, skipping` notices on repeated migration. Its exit status was 0, and the temporary container was removed on completion.

## Limits

This is database/controller integration evidence, separate from HTTP/gateway E2E. Context identities are supplied directly to the controller, so header trust, token validation, route binding, and error serialization are not tested. No real messages, real customer data, project database writes, deployments, or remote pushes were performed. This run does not establish all customer-service or other-domain tenant isolation.
