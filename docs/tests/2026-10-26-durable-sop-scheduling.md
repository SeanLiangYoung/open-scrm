# Durable SOP scheduling verification — 2026-10-26

## Implemented scope

The operation service now stores trigger-time enabled step snapshots and absolute PostgreSQL deadlines, claims due records with bounded `SKIP LOCKED` leases, persists an action-start marker before downstream work, and fences progress writes with the claim token. A singleton lifecycle worker polls on readiness and stops on shutdown. No new Redis/Bull queue was introduced.

These are builder decisions within the requested reliability work: pause keeps the absolute deadline; overdue resume becomes eligible immediately; ambiguous started actions fail closed instead of retrying; legacy unsnapshotted running/paused executions terminate with an explicit reason. Status codes and currentStep meaning are retained. Current enabled/type/template ownership checks remain required on resume, while actual actions use the frozen snapshot.

The migration is a deliverable, not a business database deployment. All migration execution below was confined to dedicated disposable PG16 containers. Main task owns canonical init SQL, root index, CI and combined real HTTP/bootstrap verification.

## Red/green evidence

- Durable trigger test first failed because the old implementation saved a row and started a process runner, never calling the durable store (expected enqueue once, observed zero).
- Six worker contract assertions failed against the initial empty worker, then passed with marker-before-effect/progress-after-effect, validation, bounded polling and heartbeat behavior.
- Slow heartbeat regression first observed three overlapping renewal queries where one was expected; the renewal guard reduced it to one.
- Real PostgreSQL exposed ambiguous INT/SMALLINT inference for the status parameter (`42P08`); explicit SMALLINT casts fixed the actual INSERT.
- Real paused final-success regression first returned status3 after resume instead of1; complete progress now resumes directly to completion without another action.
- Paused action failure regression first replaced the original downstream evidence with a legacy reason; resume/recovery now preserve the real failure.
- Shared runtime harness audit found legacy malformed template actions expect HTTP200 trigger and a failed execution record. New dedicated PG regression reproduced a throw instead; enqueue now stores terminal failure history with zero progress and no action deadline/dispatch. New template DTO/persistence validation remains unchanged.

## Leaf checks

From `code/services/operation-service`, with `PATH=/tmp/open-scrm-tools:$PATH`:

- `pnpm test`: **13 files / 287 tests passed**.
- `pnpm type-check`: passed.
- Existing execution control and legacy action-boundary scenarios were moved from the removed local runner to the durable worker/action boundary. The 28 original execution scenarios and 50 action-boundary scenarios remain; two stable message-key cases were added, alongside trigger/scheduler coverage.
- No production build, dist mutation or HTTP bootstrap was run by this worker task. Vite prints its existing CJS deprecation notice; this is not a failed test.

## Actual PostgreSQL and OS process checks

Run from repository root:

```sh
PATH=/tmp/open-scrm-tools:$PATH code/scripts/test/durable-sop-postgres.sh
```

**15 scenarios passed**, using a dedicated `postgres:16-alpine` container, random loopback port and disposable database/credentials. Current TypeScript sources are transpiled in memory. Independent child Node workers execute the production store and scheduler. The controlled downstream action writes receipt rows in the disposable database; it does not send messages or call business HTTP endpoints.

1. Apply the migration twice to legacy running/paused rows; terminate once, preserve completed progress/prior logs, leave existing terminal statuses intact.
2. Invalid persisted template content creates failed status3/currentStep0 history, with no due time or downstream receipt.
3. A 365-day deadline persists as the correct database timestamp and remains ineligible; mutating the caller's steps cannot change the saved snapshot.
4. Kill a waiting worker, start a new OS process, verify the exact saved deadline is unchanged and receipt time is at/after it.
5. Save without any local kick; two workers produce only one receipt while the winning action is held.
6. Start both independent workers first, then insert a due execution; competing workers produce only one held receipt and one completion.
7. Kill after claim but before marker, expire its lease, recover in a new OS process; the old token cannot append progress/logs.
8. Kill after marker but before effect; recovery produces unknown-outcome status3 and zero receipts.
9. Kill after a downstream receipt but before progress persistence; recovery produces unknown-outcome status3 and keeps exactly one receipt, with no replay.
10. Pause/resume during an in-flight held action, run another worker, and verify ownership/deadline/count stay stable with one receipt.
11. Last action confirms while paused: progress records under status2; resume completes under status1 with one receipt.
12. Cancel in flight: confirmed progress records while status3 remains terminal.
13. Pause in flight then fail: immediate pause evidence remains; resume terminates without replay and retains the original error.
14. Reapply migration after new snapshotted data exists: valid final paused progress with NULL due and actual failed-action evidence survive; resume completes the former and recovery retains the latter's exact failure.
15. Pause/cancel before dispatch prevents receipts; a different tenant cannot resume the paused execution.

Lease expiry in fault cases is advanced explicitly inside the disposable database after killing the owner; waiting/restart uses the actual unchanged due timestamp. This is controlled fault injection, not a real provider delivery study.

## Harness cleanup checks

```sh
PATH=/tmp/open-scrm-tools:$PATH node code/scripts/test/check-durable-sop-cleanup.cjs
```

Passed real injected `docker start` failure (exit125) and real SIGTERM interruption (exit143). Containers are created and their IDs registered before start. Both created containers were absent after cleanup, verified with successful Docker queries. The interrupted parent killed/reaped both owned OS workers; `process.kill(pid,0)` then returned ESRCH for both. The shell forwards termination to the Node parent and reaps it before deleting the container; workers also exit when disconnected. Cleanup fails if container removal, daemon access or absence verification fails.

The connection guard rejects the default business port5432, zero, >65535 and non-numeric ports before connecting. The normal 15-scenario harness also reran after cleanup hardening. No preexisting containers or project databases were reused or removed.

## Existing shared harness audit

`overnight-operation-http.cjs` and its E2E create executions through real API trigger/control, not seeded unsnapshotted status0/2 rows. `overnight-sop-action-http.cjs` seeds invalid **template steps**, then expects six failed/no-progress and five successful execution records; these assertions remain legitimate and unchanged. `overnight-sop-postgres.cjs` tests template transactions, not scheduler recovery. Analytics seeds only completed/failed historical execution rows. No shared fixtures were weakened or changed by this task. Root integration must rebuild and run real service HTTP tests against canonical schema to verify Midway lifecycle wiring and downstream contracts together.

## Limits

- A start marker commits before the HTTP call. Crashing in that gap deliberately stops a potentially unsent action rather than risking duplicates. An already initiated or stalled old request can still finish after pause/cancel or lease recovery; a token cannot retract downstream work.
- Stable message keys reuse existing message-log uniqueness. Existing pending/unknown message results are not reconciled automatically; there is no exactly-once external delivery guarantee.
- Notifications/customer updates/tags have no new dedup receipts. Unknown outcomes require manual investigation/new execution; retries after an action-start marker are not enabled.
- The per-process concurrency bound is not a global tenant marketing quota. Automatic event triggers, trigger-request idempotency, third-party provider integrations are separate work.
- All old operation workers must be stopped before applying the migration/starting new workers, because old runners do not honor leases. The task did not upgrade a business database or deploy production.

## 根集成验收

根已同步canonical init的5字段和2索引，并实际启动Midway新单例worker：运营HTTP5项原有场景通过，SQL确认5次Mock分发；最新全50包括schemaaudit、运营HTTP、SOP动作HTTP等全部通过。主线程独立重跑15组真实进程PG与启动失败/SIGTERM清理自检均通过。见[持续推进交付](2026-10-26-durable-upload-delivery.md)。迁移未施加既有业务数据库。
