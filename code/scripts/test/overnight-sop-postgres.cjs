'use strict';
// Run through the companion shell harness, against its disposable database only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const serviceRoot = path.resolve(__dirname, '../../services/operation-service');
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
const { SopTemplateService } = require(path.join(serviceRoot, 'src/service/sop-template.service.ts'));
const { SopTemplateEntity } = require(path.join(serviceRoot, 'src/entity/sop-template.entity.ts'));
const { SopStepEntity } = require(path.join(serviceRoot, 'src/entity/sop-step.entity.ts'));
async function main() {
  const port = Number(process.env.OVERNIGHT_PG_PORT);
  assert(Number.isInteger(port) && port > 0, 'Use companion disposable-container harness');
  const db = new DataSource({
    type: 'postgres', host: '127.0.0.1', port,
    username: 'overnight_verify', password: 'disposable_local_verification', database: 'overnight_sop',
    entities: [SopTemplateEntity, SopStepEntity], synchronize: false
  });
  await db.initialize();
  const checks = [];
  const check = async (name, run) => { await run(); checks.push(name); };
  try {
    const templates = db.getRepository(SopTemplateEntity);
    const steps = db.getRepository(SopStepEntity);
    const service = Object.assign(new SopTemplateService(), { templateRepository: templates, stepRepository: steps });
    const template = await templates.save(templates.create({ corpId: 901, templateName: '临时事务测试', templateType: 1, triggerType: 4, createUserId: 907 }));
    const old = await steps.save(steps.create({ templateId: template.id, stepOrder: 1, stepName: '原步骤', stepType: 1, actionContent: { content: 'old' } }));
    const replacement = (name = '新步骤') => ({ templateId: template.id, steps: [{ stepOrder: 1, stepName: name, stepType: 1, actionContent: { content: name } }] });
    await check('PostgreSQL16 confirmed', async () => {
      const [row] = await db.query("SELECT current_setting('server_version_num')::int AS version");
      assert.equal(Math.floor(row.version / 10000), 16);
    });
    await check('database save failure rolls back deletion and preserves original step ID/content', async () => {
      await db.query("ALTER TABLE sop_step ADD CONSTRAINT sop_batch_controlled_failure CHECK (step_name <> 'controlled-batch-failure')");
      await assert.rejects(() => service.batchCreateSteps(replacement('controlled-batch-failure'), 901), error => error.driverError?.code === '23514');
      await db.query('ALTER TABLE sop_step DROP CONSTRAINT sop_batch_controlled_failure');
      const rows = await steps.findBy({ templateId: template.id });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, old.id);
      assert.equal(rows[0].stepName, '原步骤');
      assert.deepEqual(rows[0].actionContent, { content: 'old' });
    });
    await check('cross-tenant replacement rejects before any mutation', async () => {
      await assert.rejects(() => service.batchCreateSteps(replacement(), 902), /模板不存在/);
      assert.deepEqual((await steps.findBy({ templateId: template.id })).map(row => row.id), [old.id]);
    });
    await check('normal replacement commits and ignores nested ownership/row IDs', async () => {
      const dto = replacement();
      Object.assign(dto.steps[0], { id: 9999, templateId: 9999, status: 0 });
      await service.batchCreateSteps(dto, 901);
      const rows = await steps.findBy({ templateId: template.id });
      assert.equal(rows.length, 1);
      assert.notEqual(rows[0].id, old.id);
      assert.notEqual(rows[0].id, 9999);
      assert.equal(rows[0].stepName, '新步骤');
      assert.equal(rows[0].status, 1);
      assert.equal(await steps.countBy({ templateId: 9999 }), 0);
    });
    await check('concurrent replacements serialize into one complete batch', async () => {
      const batch = name => ({ templateId: template.id, steps: [1, 2].map(stepOrder => ({ stepOrder, stepName: `${name}-${stepOrder}`, stepType: 1, actionContent: { content: name } })) });
      await Promise.all([service.batchCreateSteps(batch('A'), 901), service.batchCreateSteps(batch('B'), 901)]);
      const rows = await steps.find({ where: { templateId: template.id }, order: { stepOrder: 'ASC' } });
      assert.equal(rows.length, 2);
      assert(rows.every(row => row.actionContent.content === rows[0].actionContent.content));
      assert.deepEqual(rows.map(row => row.stepOrder), [1, 2]);
    });
    console.log(JSON.stringify({ scope: 'PostgreSQL16 + TypeORM SOP transaction (no HTTP)', passed: checks.length, checks }, null, 2));
  } finally { await db.destroy(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
