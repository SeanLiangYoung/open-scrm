'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../services/operation-service');
const serviceRequire = createRequire(path.join(root, 'package.json'));
const ts = serviceRequire('typescript');
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(path.join(root, 'src') + path.sep)) throw new Error(`Unexpected source: ${filename}`);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true,
    emitDecoratorMetadata: true, esModuleInterop: true
  } }).outputText, filename);
};
const { DataSource } = serviceRequire('typeorm');
const { SopExecutionEntity } = require(path.join(root,'src/entity/sop-execution.entity.ts'));
const { SopScheduleStore, LEGACY_SOP_REASON, UNKNOWN_SOP_REASON } = require(path.join(root,'src/service/sop-schedule-store.service.ts'));
const { SopScheduler } = require(path.join(root,'src/service/sop-scheduler.service.ts'));
const { SopExecutionService } = require(path.join(root,'src/service/sop-execution.service.ts'));
async function connect() {
  const port=Number(process.env.DURABLE_SOP_PG_PORT);
  if (!Number.isInteger(port)||port<1||port>65535||port===5432) throw new Error('Use dedicated disposable PG harness');
  const db=new DataSource({type:'postgres',host:'127.0.0.1',port,username:'durable_verify',password:'disposable_durable_only',database:'durable_sop',entities:[SopExecutionEntity],synchronize:false});
  await db.initialize();
  return {db,store:Object.assign(new SopScheduleStore(),{executionRepository:db.getRepository(SopExecutionEntity)})};
}
module.exports={connect,SopScheduler,SopExecutionService,SopExecutionEntity,LEGACY_SOP_REASON,UNKNOWN_SOP_REASON};
