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
const { CustomerService } = require(path.join(serviceRoot, 'src/service/customer.service.ts'));
const { CustomerEntity } = require(path.join(serviceRoot, 'src/entity/customer.entity.ts'));
const { TagEntity } = require(path.join(serviceRoot, 'src/entity/tag.entity.ts'));
const { getSchema } = serviceRequire('@midwayjs/validate');
const { CreateCustomerDto } = require(path.join(serviceRoot, 'src/dto/create-customer.dto.ts'));
const { UpdateCustomerDto } = require(path.join(serviceRoot, 'src/dto/update-customer.dto.ts'));
async function main() {
  const port = Number(process.env.OVERNIGHT_PG_PORT);
  assert(Number.isInteger(port) && port > 0, 'Use the companion disposable-container harness');
  const db = new DataSource({ type: 'postgres', host: '127.0.0.1', port,
    username: 'overnight_verify', password: 'disposable_local_verification', database: 'overnight_assignment',
    entities: [CustomerEntity, TagEntity], synchronize: false });
  await db.initialize();
  const checks = [];
  const check = async (name, run) => { await run(); checks.push(name); };
  try {
    const [version] = await db.query("SELECT current_setting('server_version_num')::int AS version");
    assert.equal(Math.floor(version.version / 10000), 16);
    await db.query(`INSERT INTO "user" (id,corp_id,username,password,status) SELECT id,corp,username,password,state FROM (VALUES
      (771,771,'assignment_enabled',1),(772,771,'assignment_disabled',0),
      (773,772,'assignment_foreign',1),(774,771,'assignment_other_enabled',1)
    ) AS fixture(id,corp,username,state) CROSS JOIN (SELECT password FROM "user" WHERE username='admin') AS seed`);
    const repo = db.getRepository(CustomerEntity);
    const service = Object.assign(new CustomerService(), { customerRepository: repo,
      ctx: { get: name => ({ 'x-corp-id':'771','x-user-id':'771' })[name] || '' } });
    let customer;
    await check('create assigned to same-enterprise enabled employee', async () => {
      customer = await service.create({ externalUserid: 'assignment-owned', name: '拥有者测试', mobile: '13800138000', remark: '待清除备注', followUserId: 771 });
      assert.equal(String((await repo.findOneByOrFail({ id: customer.id })).followUserId), '771');
    });
    await check('update assigned to another same-enterprise enabled employee', async () => {
      await service.update(customer.id, { followUserId: 774 });
      assert.equal(String((await repo.findOneByOrFail({ id: customer.id })).followUserId), '774');
    });
    for (const [kind,id] of [['disabled',772],['foreign',773],['missing',99999]]) {
      await check(`create rejects ${kind} employee without inserting a customer`, async () => {
        const count = await repo.countBy({ corpId: 771 });
        await assert.rejects(() => service.create({ externalUserid: `reject-${kind}`, followUserId: id }), { status: 400 });
        assert.equal(await repo.countBy({ corpId: 771 }), count);
      });
      await check(`update rejects ${kind} employee and preserves original assignment`, async () => {
        await assert.rejects(() => service.update(customer.id, { followUserId: id }), { status: 400 });
        assert.equal(String((await repo.findOneByOrFail({ id: customer.id })).followUserId), '774');
      });
    }
    await check('omitted owner creates unassigned customer', async () => {
      const row = await service.create({ externalUserid: 'assignment-omitted' });
      assert.equal((await repo.findOneByOrFail({ id: row.id })).followUserId, null);
    });
    await check('omitted owner preserves assignment during unrelated update even if employee later disabled', async () => {
      await db.query('UPDATE "user" SET status=0 WHERE id=$1', [774]);
      await service.update(customer.id, { name: '仅改姓名' });
      assert.equal(String((await repo.findOneByOrFail({ id: customer.id })).followUserId), '774');
    });
    await check('explicit null clears nullable mobile/remark in PostgreSQL and preserves owner', async () => {
      const payload = { mobile: null, remark: null };
      assert.equal(getSchema(UpdateCustomerDto).validate(payload).error, undefined);
      await service.update(customer.id, payload);
      const row = await repo.findOneByOrFail({ id: customer.id });
      assert.equal(row.mobile, null);
      assert.equal(row.remark, null);
      assert.equal(String(row.followUserId), '774');
    });
    await check('repaired create/edit payloads satisfy authoritative DTO schemas', async () => {
      assert.equal(getSchema(CreateCustomerDto).validate({ externalUserid:'ext_123', name:'新客户', gender:0, channel:'wechat' }).error, undefined);
      assert.equal(getSchema(UpdateCustomerDto).validate({ name:'新姓名', gender:1, mobile:'13800138000', remark:'备注' }).error, undefined);
      assert(getSchema(CreateCustomerDto).validate({ externalUserid:'ext_old', name:'旧表单', gender:0, mobile:'', email:'', source:'wechat', remark:'', corpId:1, followUserId:1 }).error);
    });
    await check('explicit null owner unassigns in PostgreSQL while preserving tenant boundary', async () => {
      assert.equal(getSchema(UpdateCustomerDto).validate({ followUserId: null }).error, undefined);
      const foreignService = Object.assign(new CustomerService(), { customerRepository: repo,
        ctx: { get: name => ({ 'x-corp-id':'772','x-user-id':'773' })[name] || '' } });
      await assert.rejects(() => foreignService.update(customer.id, { followUserId: null }));
      await assert.rejects(() => service.update(customer.id + 99999, { followUserId: null }));
      assert.equal(String((await repo.findOneByOrFail({ id: customer.id })).followUserId), '774');
      await service.update(customer.id, { followUserId: null });
      assert.equal((await repo.findOneByOrFail({ id: customer.id })).followUserId, null);
    });
    await check('exact fixture customer count remains two after rejections', async () => {
      assert.equal(await repo.countBy({ corpId: 771 }), 2);
    });
    console.log(JSON.stringify({ scope:'actual PostgreSQL16+CustomerService assignment and DTO schemas (no HTTP)', passed:checks.length, customerRows:2, checks }, null, 2));
  } finally { await db.destroy(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
