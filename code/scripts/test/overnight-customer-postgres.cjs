'use strict';
// Run through the companion shell harness, against its disposable database only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const serviceRoot = path.resolve(__dirname, '../../services/customer-service');
const serviceRequire = createRequire(path.join(serviceRoot, 'package.json'));
const ts = serviceRequire('typescript');
const { DataSource } = serviceRequire('typeorm');
// Compile current sources in memory; no dist output or ts-node installation needed.
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(path.join(serviceRoot, 'src') + path.sep)) {
    throw new Error(`Unexpected TypeScript source: ${filename}`);
  }
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      esModuleInterop: true
    }
  }).outputText, filename);
};
const { FollowUpController } = require(path.join(serviceRoot, 'src/controller/follow-up.controller.ts'));
const { FollowUpEntity } = require(path.join(serviceRoot, 'src/entity/follow-up.entity.ts'));
const { CustomerEntity } = require(path.join(serviceRoot, 'src/entity/customer.entity.ts'));
const { TagEntity } = require(path.join(serviceRoot, 'src/entity/tag.entity.ts'));
const checks = [];
async function check(name, test) {
  await test();
  checks.push(name);
}
function controller(db, corpId = '901', userId = '907') {
  return Object.assign(new FollowUpController(), {
    ctx: { get: key => ({ 'x-corp-id': corpId, 'x-user-id': userId })[key] || '' },
    customerRepo: db.getRepository(CustomerEntity),
    followUpRepo: db.getRepository(FollowUpEntity)
  });
}
async function main() {
  const port = Number(process.env.OVERNIGHT_PG_PORT);
  assert(Number.isInteger(port) && port > 0, 'Use the companion disposable-container shell harness');
  const db = new DataSource({
    type: 'postgres', host: '127.0.0.1', port,
    username: 'overnight_verify', password: 'disposable_local_verification', database: 'overnight_customer',
    entities: [CustomerEntity, TagEntity, FollowUpEntity], synchronize: false
  });
  await db.initialize();
  try {
    await check('PostgreSQL major version 16', async () => {
      const [row] = await db.query("SELECT current_setting('server_version_num')::int AS version");
      assert.equal(Math.floor(row.version / 10000), 16);
    });
    await check('follow-up schema after init plus two migrations', async () => {
      const rows = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='customer_follow_up'");
      const columns = Object.fromEntries(rows.map(row => [row.column_name, row.data_type]));
      assert.equal(columns.follow_type, 'smallint');
      assert.equal(columns.next_follow_time, 'timestamp without time zone');
      assert.equal(columns.corp_id, 'bigint');
      const indexes = await db.query("SELECT indexname FROM pg_indexes WHERE tablename='customer_follow_up'");
      assert(indexes.some(row => row.indexname === 'idx_customer_follow_up_corp_customer_time'));
    });
    const customerRepo = db.getRepository(CustomerEntity);
    const repo = db.getRepository(FollowUpEntity);
    const own = await customerRepo.save(customerRepo.create({ corpId: 901, externalUserid: 'overnight-own', name: '临时测试客户A' }));
    const other = await customerRepo.save(customerRepo.create({ corpId: 902, externalUserid: 'overnight-other', name: '临时测试客户B' }));
    const a = controller(db);
    const b = controller(db, '902', '908');
    await check('forged body identities ignored; null time and default type persist', async () => {
      const result = await a.create({ customerId: own.id, corpId: 902, userId: 999, content: '预约确认', nextFollowTime: null });
      assert.equal(result.code, 200);
      const row = await repo.findOneByOrFail({ id: result.data.id });
      assert.equal(String(row.corpId), '901');
      assert.equal(String(row.userId), '907');
      assert.equal(row.followType, 1);
      assert.equal(row.nextFollowTime, null);
    });
    await check('valid time and follow type persist through PostgreSQL', async () => {
      const result = await a.create({ customerId: own.id, content: '再次联系', followType: 4, nextFollowTime: '2028-02-29T08:00:00.000Z' });
      const row = await repo.findOneByOrFail({ id: result.data.id });
      assert.equal(row.followType, 4);
      assert.equal(row.nextFollowTime.toISOString(), '2028-02-29T08:00:00.000Z');
    });
    await check('other tenant writes its own customer', async () => {
      await b.create({ customerId: other.id, content: '企业B记录' });
      assert.equal(await repo.countBy({ corpId: 902 }), 1);
    });
    // Deliberately inconsistent legacy fixture proves the list filters BOTH keys.
    await repo.save(repo.create({ corpId: 902, userId: 908, customerId: own.id, content: '隔离污染夹具', followType: 1, nextFollowTime: null }));
    await check('list filters tenant even for inconsistent legacy customer key', async () => {
      const result = await a.listByCustomer(String(own.id));
      assert.equal(result.data.total, 2);
      assert(result.data.list.every(row => String(row.corpId) === '901'));
    });
    await check('pagination returns requested size and total', async () => {
      const result = await a.listByCustomer(String(own.id), '2', '1');
      assert.equal(result.data.list.length, 1);
      assert.equal(result.data.total, 2);
      assert.equal(result.data.page, 2);
    });
    for (const [name, call] of [
      ['cross-tenant write', () => a.create({ customerId: other.id, content: '禁止' })],
      ['cross-tenant list', () => a.listByCustomer(String(other.id))],
      ['reverse cross-tenant list', () => b.listByCustomer(String(own.id))],
      ['missing customer', () => a.listByCustomer('99999999')]
    ]) {
      await check(`${name} returns 404`, () => assert.rejects(call, { status: 404 }));
    }
    const noIdentity = controller(db, '', '');
    await check('missing identity returns 401', () => assert.rejects(() => noIdentity.create({ customerId: own.id, content: '禁止' }), { status: 401 }));
    const stateIdentity = controller(db, '', '');
    stateIdentity.ctx.state = { user: { corpId: '901', userId: '909' } };
    await check('verified context fallback lists owned records', async () => {
      assert.equal((await stateIdentity.listByCustomer(String(own.id))).data.total, 2);
    });
    for (const [name, body] of [
      ['null body', null], ['array body', []], ['empty content', { customerId: own.id, content: '  ' }],
      ['object content', { customerId: own.id, content: {} }],
      ['invalid type', { customerId: own.id, content: '禁止', followType: 0 }],
      ['invalid date', { customerId: own.id, content: '禁止', nextFollowTime: '2026-02-30T10:00:00.000Z' }]
    ]) await check(`${name} returns 400`, () => assert.rejects(() => a.create(body), { status: 400 }));
    for (const [name, args] of [
      ['ambiguous ID', ['1e1']], ['array ID', [[own.id]]],
      ['oversize page', [String(own.id), '1', '101']],
      ['unsafe offset', [String(own.id), String(Number.MAX_SAFE_INTEGER), '100']]
    ]) await check(`${name} returns 400`, () => assert.rejects(() => a.listByCustomer(...args), { status: 400 }));
    await check('rejected requests leave exact follow-up row count unchanged', async () => {
      assert.equal(await repo.count(), 4);
      assert.equal(await repo.countBy({ corpId: 901 }), 2);
      assert.equal(await repo.countBy({ corpId: 902 }), 2);
    });
    console.log(JSON.stringify({ scope: 'PostgreSQL16 + TypeORM + controller (no HTTP/gateway)', passed: checks.length, followUpRows: 4, customerFixtureRows: 2, checks }, null, 2));
  } finally {
    await db.destroy();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
