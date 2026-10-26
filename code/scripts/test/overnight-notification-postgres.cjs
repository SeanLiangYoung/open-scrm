'use strict';
// Actual service and TypeORM against the companion script's disposable PG16 only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const serviceRoot = path.resolve(__dirname, '../../services/message-service');
const serviceRequire = createRequire(path.join(serviceRoot, 'package.json'));
const ts = serviceRequire('typescript');
const { DataSource } = serviceRequire('typeorm');
require.extensions['.ts'] = (module, filename) => {
  assert(filename.startsWith(path.join(serviceRoot, 'src') + path.sep));
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }
  }).outputText, filename);
};
const { NotificationService } = require(path.join(serviceRoot, 'src/service/notification.service.ts'));
const { NotificationEntity } = require(path.join(serviceRoot, 'src/entity/notification.entity.ts'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const dto = (userIds, title = 'temporary verification') => ({ userIds, notificationType: 1, title, content: 'No external message', linkUrl: '/customers/10', extra: { source: 'verification' }, expireDays: 2 });
async function main() {
  const port = Number(process.env.OVERNIGHT_PG_PORT);
  assert(Number.isSafeInteger(port) && port > 0, 'Use the disposable companion harness');
  const db = new DataSource({ type: 'postgres', host: '127.0.0.1', port,
    username: 'overnight_verify', password: 'disposable_local_verification', database: 'overnight_notification',
    entities: [NotificationEntity], synchronize: false });
  await db.initialize();
  const checks = [];
  const check = async (name, run) => { await run(); checks.push(name); };
  try {
    const repository = db.getRepository(NotificationEntity);
    const service = Object.assign(new NotificationService(), { notificationRepository: repository, notificationConfig: { defaultExpireDays: 30 } });
    await db.query(`INSERT INTO "user" (id,corp_id,username,password,status) VALUES
      (4101,901,'notification-own-a','unused',1),(4102,901,'notification-own-b','unused',1),
      (4103,901,'notification-disabled','unused',0),(4201,902,'notification-foreign','unused',1),
      (4105,901,'notification-lock','unused',1)`);
    await check('PostgreSQL16 and real notification metadata initialize', async () => {
      const [row] = await db.query("SELECT current_setting('server_version_num')::int AS version");
      assert.equal(Math.floor(row.version / 10000), 16);
    });
    await check('enabled own recipients are deduplicated with optional data preserved', async () => {
      assert.deepEqual(await service.createNotification(901, dto([4101,4102,4101])), { success: true, count: 2 });
      const rows = await repository.find({ where: { corpId: 901 }, order: { userId: 'ASC' } });
      assert.deepEqual(rows.map(row => String(row.userId)), ['4101','4102']);
      assert.equal(rows[0].linkUrl, '/customers/10');
      assert.deepEqual(rows[0].extra, { source: 'verification' });
      assert(rows[0].expireTime instanceof Date);
    });
    await check('foreign, disabled and missing recipients reject entire mixed batches without writes', async () => {
      for (const invalidId of [4201,4103,4199]) {
        const before = await repository.count();
        await assert.rejects(() => service.createNotification(901, dto([4101,invalidId])), error => error.status === 400);
        assert.equal(await repository.count(), before);
      }
    });
    await check('empty, malformed and unsafe recipient batches reject without writes', async () => {
      for (const ids of [[],[0],[-1],[1.5],['4101'],[null],[Number.MAX_SAFE_INTEGER+1],[4101,'4102']]) {
        const before = await repository.count();
        await assert.rejects(() => service.createNotification(901, dto(ids)), error => error.status === 400);
        assert.equal(await repository.count(), before);
      }
    });
    await check('second-row database failure leaves no first-row notification', async () => {
      await db.query(`CREATE FUNCTION notification_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.user_id=4102 AND NEW.title='force rollback' THEN RAISE EXCEPTION 'injected second recipient rejection'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER notification_test_fail BEFORE INSERT ON notification FOR EACH ROW EXECUTE FUNCTION notification_test_fail()`);
      const before = await repository.count();
      await assert.rejects(() => service.createNotification(901, dto([4101,4102], 'force rollback')), /injected second recipient rejection/);
      assert.equal(await repository.count(), before);
      await db.query('DROP TRIGGER notification_test_fail ON notification; DROP FUNCTION notification_test_fail()');
    });
    await check('shared recipient lock blocks disable until complete batch commit', async () => {
      let release;
      let locked;
      const gate = new Promise(resolve => { release = resolve; });
      const lockReached = new Promise(resolve => { locked = resolve; });
      const controlledRepository = { manager: { transaction: work => db.manager.transaction(manager => work({
        getRepository: entity => manager.getRepository(entity),
        query: async (sql, parameters) => {
          const result = await manager.query(sql, parameters);
          if (sql.includes('FOR SHARE')) { locked(); await gate; }
          return result;
        }
      })) } };
      const controlledService = Object.assign(new NotificationService(), { notificationRepository: controlledRepository, notificationConfig: { defaultExpireDays: 30 } });
      const runner = db.createQueryRunner();
      await runner.connect();
      const [{ pid }] = await runner.query('SELECT pg_backend_pid() AS pid');
      const creation = controlledService.createNotification(901, dto(4105, 'lock verification'));
      let disable;
      try {
        await Promise.race([lockReached, pause(3000).then(() => { throw new Error('Recipient lock not reached'); })]);
        disable = runner.query('UPDATE "user" SET status=0 WHERE id=4105');
        let observedBlocked = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const [state] = await db.query('SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked', [pid]);
          if (state.blocked) { observedBlocked = true; break; }
          await pause(20);
        }
        assert(observedBlocked, 'Disabling employee must wait for validated batch to commit');
        release();
        assert.deepEqual(await creation, { success: true, count: 1 });
        await disable;
        const before = await repository.count();
        await assert.rejects(() => service.createNotification(901, dto(4105)), error => error.status === 400);
        assert.equal(await repository.count(), before);
      } finally { release(); await Promise.allSettled([creation, disable]); await runner.release(); }
    });
    console.log(JSON.stringify({ scope: 'PostgreSQL16 + notification TypeORM/service; no HTTP or external delivery', passed: checks.length, checks }, null, 2));
  } finally { await db.destroy(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
