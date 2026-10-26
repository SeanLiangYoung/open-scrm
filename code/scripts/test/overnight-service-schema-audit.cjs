'use strict';
// Readiness audit only: memory-compile current entities, never load applications or services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const servicesRoot = path.resolve(__dirname, '../../services');
const names = ['acquisition-service','integration-service','analytics-service','asset-service','content-generation-service'];
const request = createRequire(path.join(servicesRoot,'analytics-service/package.json'));
const ts = request('typescript');
const { DataSource, getMetadataArgsStorage } = request('typeorm');
require.extensions['.ts'] = (module, filename) => {
  assert(names.some(name => filename.startsWith(path.join(servicesRoot,name,'src') + path.sep)), `Unexpected source ${filename}`);
  module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true,
    emitDecoratorMetadata: true, esModuleInterop: true
  } }).outputText, filename);
};
const quote = value => `"${String(value).replace(/"/g,'""')}"`;
async function main() {
  const port = Number(process.env.OVERNIGHT_PG_PORT);
  assert(Number.isSafeInteger(port) && port > 0, 'Use disposable companion shell');
  const options = { type:'postgres',host:'127.0.0.1',port,username:'overnight_verify',password:'disposable_local_verification',database:'overnight_schema_audit',synchronize:false };
  const catalog = new DataSource({ ...options, entities:[] });
  await catalog.initialize();
  const report = { scope:'5 implemented customer-operations services; metadata/catalog/read probes only, no app HTTP or external access',
    node:process.version, auditCompleted:false, services:[], blockers:[], observations:[] };
  try {
    const [version] = await catalog.query("SELECT version() AS version,current_setting('server_version_num')::int AS version_number");
    assert.equal(Math.floor(version.version_number / 10000),16);
    report.postgres = version.version;
    for (const name of names) {
      const directory = path.join(servicesRoot,name,'src/entity');
      const files = fs.readdirSync(directory).filter(file => file.endsWith('.entity.ts')).sort();
      const entities = files.flatMap(file => Object.values(require(path.join(directory,file))).filter(value =>
        typeof value === 'function' && getMetadataArgsStorage().tables.some(table => table.target === value)));
      assert(entities.length, `No declared entities for implemented service ${name}`);
      const service = { name, declaredEntities:entities.length, metadataReady:false, tables:[] };
      report.services.push(service);
      const source = new DataSource({ ...options,entities });
      try {
        await source.initialize();
        service.metadataReady = true;
        for (const metadata of source.entityMetadatas) {
          const table = { name:metadata.tableName, columns:metadata.columns.length, exists:false, selectReady:false, ormReadReady:false };
          service.tables.push(table);
          const [registered] = await catalog.query('SELECT to_regclass($1) AS relation',[`public.${metadata.tableName}`]);
          table.exists = registered.relation !== null;
          if (!table.exists) {
            report.blockers.push({service:name,table:table.name,kind:'missing_table',rootCause:'Current full init SQL does not create the declared table; synchronize=false will not repair it'});
            continue;
          }
          const actual = await catalog.query("SELECT column_name,data_type,is_nullable,column_default,is_identity,character_maximum_length FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",[metadata.tableName]);
          const columns = new Map(actual.map(column => [column.column_name,column]));
          const expectedNames = new Set(metadata.columns.map(column => column.databaseName));
          for (const column of metadata.columns) {
            const found = columns.get(column.databaseName);
            if (!found) { report.blockers.push({service:name,table:table.name,column:column.databaseName,kind:'missing_column'}); continue; }
            const expected = source.driver.normalizeType(column);
            if (expected !== found.data_type) {
              const compatibleJson = [expected,found.data_type].every(type => ['json','jsonb'].includes(type));
              let jsonbHydrationReady;
              if (compatibleJson) {
                const sample = { audit:true,ids:[1,2] };
                const [raw] = await catalog.query('SELECT $1::jsonb AS payload',[JSON.stringify(sample)]);
                assert.deepEqual(source.driver.prepareHydratedValue(raw.payload,column),sample);
                jsonbHydrationReady = true;
              }
              report.observations.push({service:name,table:table.name,column:column.databaseName,
                kind:compatibleJson?'compatible_json_storage_drift':'type_drift_requires_review',
                entityType:expected,databaseType:found.data_type,...(compatibleJson?{jsonbHydrationReady}:{} )});
            }
            if (column.length && found.character_maximum_length && Number(column.length)>found.character_maximum_length)
              report.blockers.push({service:name,table:table.name,column:column.databaseName,kind:'database_length_shorter_than_entity',expected:column.length,actual:found.character_maximum_length});
          }
          for (const found of actual) if (!expectedNames.has(found.column_name) && found.is_nullable==='NO' && found.column_default===null && found.is_identity!=='YES')
            report.blockers.push({service:name,table:table.name,column:found.column_name,kind:'required_database_column_missing_from_entity'});
          try {
            await catalog.query(`SELECT ${metadata.columns.map(column => quote(column.databaseName)).join(',')} FROM public.${quote(metadata.tableName)} LIMIT 0`);
            table.selectReady = true;
            const rows = await source.getRepository(metadata.target).find({take:1});
            table.ormReadReady = true;
            table.probedRows = rows.length;
          } catch (error) { report.blockers.push({service:name,table:table.name,kind:'actual_select_failure',code:error.driverError?.code || error.code,message:error.message}); }
        }
      } catch (error) {
        report.blockers.push({service:name,kind:service.metadataReady?'schema_audit_failure':error.name==='DataTypeNotSupportedError'?'unsupported_postgres_metadata_type':'metadata_initialization_failure',message:error.message});
      } finally { if(source.isInitialized) await source.destroy(); }
    }
    report.auditCompleted = true;
    report.entityCount = report.services.reduce((sum,service)=>sum+service.declaredEntities,0);
    report.readReadyTables = report.services.flatMap(service=>service.tables).filter(table=>table.ormReadReady).length;
    console.log(JSON.stringify(report,null,2));
    if (process.env.SERVICE_SCHEMA_AUDIT_REPORT) fs.writeFileSync(process.env.SERVICE_SCHEMA_AUDIT_REPORT,JSON.stringify(report,null,2)+'\n');
    if(report.blockers.length) process.exitCode=2;
  } finally { await catalog.destroy(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
