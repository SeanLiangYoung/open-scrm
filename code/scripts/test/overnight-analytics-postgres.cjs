'use strict';
// Actual TypeORM/service calls against only the companion's disposable database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const serviceRoot = path.resolve(__dirname, '../../services/analytics-service');
const serviceRequire = createRequire(path.join(serviceRoot, 'package.json'));
const ts = serviceRequire('typescript');
const { DataSource } = serviceRequire('typeorm');
require.extensions['.ts'] = (module, filename) => {
  assert(filename.startsWith(path.join(serviceRoot, 'src') + path.sep));
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true
    }
  }).outputText, filename);
};
const { DailyStatService } = require(path.join(serviceRoot, 'src/service/daily-stat.service.ts'));
const { DailyStatEntity } = require(path.join(serviceRoot, 'src/entity/daily-stat.entity.ts'));
const { FunnelGapQueryService } = require(path.join(serviceRoot, 'src/service/funnel-gap-query.service.ts'));
const { summarizeDailyStatRange } = require(path.join(serviceRoot, 'src/util/daily-stat-summary.util.ts'));
async function main() {
  const port = Number(process.env.OVERNIGHT_PG_PORT);
  assert(Number.isSafeInteger(port) && port > 0, 'Use the disposable shell harness');
  const db = new DataSource({
    type: 'postgres', host: '127.0.0.1', port, username: 'overnight_verify',
    password: 'disposable_local_verification', database: 'overnight_analytics',
    entities: [DailyStatEntity], synchronize: false
  });
  await db.initialize();
  const checks = [];
  const check = async (name, run) => { await run(); checks.push(name); };
  try {
    const repo = db.getRepository(DailyStatEntity);
    const service = Object.assign(new DailyStatService(), { dailyStatRepository: repo });
    await check('PostgreSQL16 and real analytics metadata initialize', async () => {
      const [row] = await db.query("SELECT current_setting('server_version_num')::int AS version");
      assert.equal(Math.floor(row.version / 10000), 16);
    });
    await check('missing day explicitly reports no snapshot rather than observed zero', async () => {
      const result = await service.getOverview(901, '2026-10-21');
      assert.equal(result.snapshotAvailable, false);
      assert.equal(result.snapshotObservedAt, null);
      assert.equal(result.totalCustomerCount, 0);
    });
    await db.query(`INSERT INTO daily_stat
      (corp_id,stat_date,new_customer_count,lost_customer_count,active_customer_count,total_customer_count,
       active_staff_count,total_staff_count,message_send_count,message_success_count,sop_execute_count,sop_success_count,update_time)
      VALUES (901,'2026-10-20',2,4,6,10,2,3,4,3,4,2,'2026-10-20 01:00:00'),
             (901,'2026-10-21',3,5,8,13,2,3,6,3,2,2,'2026-10-21 02:00:00'),
             (902,'2026-10-21',100,100,900,1000,10,20,100,100,10,10,'2026-10-21 03:00:00')`);
    await check('existing snapshot carries availability, canonical counts and actual observation', async () => {
      const result = await service.getOverview(901, '2026-10-21');
      assert.equal(result.snapshotAvailable, true);
      assert.equal(result.normalCustomerCount, 8);
      assert.equal(result.deletedCustomerCount, 5);
      assert.equal(result.totalCustomerCount, 13);
      assert.equal(result.snapshotObservedAt.toISOString(), '2026-10-21T02:00:00.000Z');
      assert.equal(result.messageSuccessRate, 50);
      assert.equal(result.sopSuccessRate, 100);
    });
    await check('date and enterprise filters do not leak another enterprise snapshot', async () => {
      assert.equal((await service.getOverview(902, '2026-10-21')).totalCustomerCount, 1000);
      assert.equal((await service.getOverview(903, '2026-10-21')).snapshotAvailable, false);
      assert.equal((await service.getOverview(901, '2026-10-22')).snapshotAvailable, false);
    });
    await check('range sums events but selects only the last inventory snapshot', async () => {
      const rows = await service.queryDailyStat(901, { startDate: '2026-10-20', endDate: '2026-10-21' });
      assert.equal(rows.length, 2);
      const summary = summarizeDailyStatRange(rows);
      assert.equal(summary.additive.newCustomerCount, 5);
      assert.equal(summary.additive.messageSendCount, 10);
      assert.equal(summary.snapshotAtEnd.normalCustomerCount, 8);
      assert.equal(summary.snapshotAtEnd.deletedCustomerCount, 5);
      assert.equal(summary.snapshotAtEnd.totalCustomerCount, 13);
      assert(!Object.hasOwn(summary.additive, 'lostCustomerCount'));
    });
    await db.query(`INSERT INTO customer (id,corp_id,external_userid,name) VALUES
      (9801,901,'analytics-own','Own fixture'),(9802,902,'analytics-other','Other fixture');
      INSERT INTO message_log (corp_id,message_type,target_type,target_id,content,extra,send_status,create_time) VALUES
      (901,5,1,9801,'own','{"utm_campaign":"fixture"}',1,'2026-10-20 12:00:00'),
      (901,5,1,9802,'foreign reference','{"utm_campaign":"fixture"}',1,'2026-10-20 12:00:00'),
      (901,5,1,9803,'missing reference','{"utm_campaign":"fixture"}',1,'2026-10-20 12:00:00'),
      (901,5,1,9801,'repeat own','{"utm_campaign":"fixture"}',1,'2026-10-20 12:00:00'),
      (901,5,3,9801,'group identifier','{"utm_campaign":"fixture"}',1,'2026-10-20 12:00:00'),
      (901,5,1,9801,'failed','{"utm_campaign":"fixture"}',2,'2026-10-20 12:00:00'),
      (901,5,1,9801,'outside window','{"utm_campaign":"fixture"}',1,'2026-10-21 00:00:00'),
      (902,5,1,9801,'other enterprise foreign reference','{"utm_campaign":"fixture"}',1,'2026-10-20 12:00:00')`);
    const funnel = Object.assign(new FunnelGapQueryService(), { dataSource: db });
    const start = new Date('2026-10-20T00:00:00Z');
    const end = new Date('2026-10-21T00:00:00Z');
    await check('customer attribution counts distinct actual own customers, not foreign or missing references', async () => {
      const result = await funnel.aggregateOltp(901, start, end);
      assert.equal(result.customersTotal, 1);
      assert.equal(result.customersWithAttribution, 1);
      assert.equal(result.sendsTotal, 5);
      assert.equal(result.sendsWithTouchHint, 5);
    });
    await check('opposite enterprise customer attribution also excludes another enterprise customer ID', async () => {
      const result = await funnel.aggregateOltp(902, start, end);
      assert.equal(result.customersTotal, 1);
      assert.equal(result.customersWithAttribution, 0);
      assert.equal(result.sendsTotal, 1);
    });
    console.log(JSON.stringify({ scope: 'PostgreSQL16 + analytics TypeORM/service, no HTTP', passed: checks.length, checks }, null, 2));
  } finally { await db.destroy(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
