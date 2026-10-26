# Durable SOP scheduling implementation plan

> **For implementers:** Use superpowers:executing-plans and test-driven-development task by task. No commits or deployment in this batch.

**Goal:** Recover persisted waiting SOPs after restart and prevent two processes dispatching the same claimed step.

**Architecture:** PostgreSQL owns immutable step snapshots, absolute due times and fenced leases. A bounded process worker polls due rows. An expired claim before action start is recoverable; an expired action-start marker fails closed because downstream effects cannot all be deduplicated.

**Tech stack:** Existing Midway/TypeORM/PostgreSQL16, Vitest, disposable PostgreSQL container with child Node workers. No queue runtime added.

## Builder decisions and boundaries

The user authorized continuing unfinished reliability work; the following are builder choices for this bounded implementation, not a claim that the user separately approved each API behavior.

- Preserve status 0 running, 1 complete, 2 paused, 3 failed/cancelled and existing tenant/template enabled/type guards.
- Freeze validated enabled steps on trigger. Resume checks the current template but executes the original snapshot.
- Save absolute UTC deadlines; pause does not freeze the clock. Resume after the deadline is immediately eligible. This replaces the old restart-dependent full-delay reset.
- Never auto-repeat an action after an unresolved start marker. Recovery records unknown outcome as status3; manual investigation/new execution is required. An in-flight successful response can persist progress without overwriting pause/cancel until its token is fenced by recovery.
- Legacy status0/2 rows with no snapshot/deadline terminate with an explicit migration reason; do not infer an old due time, adopt mutable templates or replay automatically.
- Send stable execution/step keys to the existing message sender. No exactly-once claim, provider reconciliation, new automatic retries, notification receipts, customer mutation receipts or automatic triggers.
- Stop all old workers before applying the migration and starting new workers. Migration is delivered as SQL only; never apply it to a business database in this task. Main task owns fresh init SQL.

## Task 1: Contract tests (red)

Files: new `code/services/operation-service/src/service/sop-scheduler.service.spec.ts`, existing execution/action-boundary specs; new dedicated `code/scripts/test/durable-sop-postgres*.cjs` and `.sh`.

Write tests for persisted trigger snapshot/deadline, one-step dispatch, token fencing, action markers, confirmed progress, pause/resume/cancel, legacy rejection and stable message identity. Run leaf Vitest and observe missing durable implementation failures. Preserve existing invalid action and unconfirmed envelope cases when moving them to the new executor boundary.

## Task 2: Store, worker and lifecycle (green)

Files: `sop-execution.entity.ts`, new `sop-schedule-store.service.ts`, `sop-scheduler.service.ts`, extracted `sop-action.service.ts`, `sop-execution.service.ts`, `configuration.ts`, `config/config.default.ts`, new `code/scripts/migrations/2026-10-26-durable-sop-scheduling.pg.sql`.

Persist snapshot/next-run/lease/start-marker. Atomically claim bounded due work with `FOR UPDATE SKIP LOCKED`; set a random token; validate and commit the action marker before dispatch; commit next deadline/progress/log together with token guard. Polling is singleton, non-overlapping and bounded; HTTP is timed out; renew only active owned leases. Stop lifecycle clears timers. Recover stale waiting claims, fail closed unresolved actions and malformed legacy active rows. No database transaction spans downstream I/O.

## Task 3: Regression and process/database verification

Run `PATH=/tmp/open-scrm-tools:$PATH pnpm test` and `pnpm type-check` within operation-service. Use a dedicated disposable PG16 container/port; source modules are transpiled in memory, no dist/build/bootstrap. Start actual OS workers against only that temporary database with controlled fake downstream receipts. Verify restart before due, startup pickup after save without local kick, two-worker claim exclusion, stale token fence, expired pre-action recovery, kill after marker and after downstream receipt, pause/resume races, tenant guards, frozen snapshot and 30/365-day persisted deadlines. Apply migration twice to temporary legacy rows and verify preserved logs/progress and no dispatch. Cleanup owned processes/container only.

## Task 4: Evidence and documentation

Update `docs/services/operation-service/README.md` and `docs/tests/2026-10-26-durable-sop-scheduling.md` with exact checks/results, migration instructions, absolute pause semantics, ambiguity handling and no exactly-once claim. Give main task the fresh init SQL snippet and test commands; main owns root index/CI/init SQL integration.
