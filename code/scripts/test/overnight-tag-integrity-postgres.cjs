'use strict';
// Dedicated PostgreSQL16, actual current TypeORM/controller/services, no Bootstrap/build/HTTP.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..'),serviceRoot=path.join(root,'services/customer-service'),req=createRequire(path.join(serviceRoot,'package.json')),ts=req('typescript');
require.extensions['.ts']=(m,f)=>{if(!f.startsWith(path.join(serviceRoot,'src')+path.sep))throw new Error('Unexpected TS source');m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,f);};
const {DataSource}=req('typeorm'),{TagEntity}=require(path.join(serviceRoot,'src/entity/tag.entity.ts')),{CustomerEntity}=require(path.join(serviceRoot,'src/entity/customer.entity.ts'));
const {TagController}=require(path.join(serviceRoot,'src/controller/tag.controller.ts')),{TagService}=require(path.join(serviceRoot,'src/service/tag.service.ts')),{CustomerService}=require(path.join(serviceRoot,'src/service/customer.service.ts'));
function command(exe,args,options={}){const r=spawnSync(exe,args,{encoding:'utf8',maxBuffer:16*1024*1024,...options});if(r.status!==0)throw new Error(`${exe} failed: ${r.stderr||r.error||r.status}`);return r.stdout.trim();}
async function main(){
 const artifactDir=fs.mkdtempSync(path.join(os.tmpdir(),'open-scrm-tag-integrity-pg-')),result={artifactDir,scope:'actual PostgreSQL16 and current TypeORM/controller/services; no Bootstrap/build/HTTP',checks:[],snapshots:[]};
 let containerId,db;console.log(`Artifacts: ${artifactDir}`);
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const cleanup=async()=>{const errors=[];if(db?.isInitialized)try{await db.destroy();}catch(e){errors.push(e.message);}if(containerId){const removed=spawnSync('docker',['rm','-f',containerId],{encoding:'utf8'});if(removed.status!==0)errors.push(removed.stderr||'removal failed');const remaining=spawnSync('docker',['ps','-a','--no-trunc','--filter',`id=${containerId}`,'--format','{{.ID}}'],{encoding:'utf8'});if(remaining.status!==0||remaining.stdout.trim())errors.push('Owned container absence not verified');}return{passed:errors.length===0,errors,containerId};};
 try{
  command('docker',['image','inspect','postgres:16-alpine']);
  containerId=command('docker',['create','--rm','--name',`open-scrm-tag-integrity-pg-${process.pid}-${Date.now()}`,'--label','open-scrm.verification=tag-integrity-pg','--publish','127.0.0.1::5432','--env','POSTGRES_DB=tag_integrity','--env','POSTGRES_USER=tag_integrity_verify','--env','POSTGRES_PASSWORD=disposable_tag_integrity_only','postgres:16-alpine']);
  command('docker',['start',containerId]);
  const port=Number(JSON.parse(command('docker',['inspect',containerId]))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort);result.port=port;
  let ready=false;for(let i=0;i<60;i++){if(spawnSync('docker',['exec',containerId,'pg_isready','-h','127.0.0.1','-U','tag_integrity_verify','-d','tag_integrity'],{stdio:'ignore'}).status===0){ready=true;break;}await wait(300);}assert(ready,'Dedicated PG startup timed out');
  command('docker',['exec','-i',containerId,'psql','-v','ON_ERROR_STOP=1','-U','tag_integrity_verify','-d','tag_integrity'],{input:fs.readFileSync(path.join(root,'scripts/init-db.pg.sql'),'utf8')});
  db=new DataSource({type:'postgres',host:'127.0.0.1',port,username:'tag_integrity_verify',password:'disposable_tag_integrity_only',database:'tag_integrity',entities:[TagEntity,CustomerEntity],synchronize:false});await db.initialize();
  const [version]=await db.query("SELECT current_setting('server_version_num')::int AS version");assert.equal(Math.floor(version.version/10000),16);result.pgVersion=version.version;
  const tags=db.getRepository(TagEntity),customers=db.getRepository(CustomerEntity),ctx={get:key=>({'x-corp-id':'2','x-user-id':'7'})[key]||''};
  const service=Object.assign(new TagService(),{tagRepository:tags,ctx}),controller=Object.assign(new TagController(),{tagService:service});
  const customer=Object.assign(new CustomerService(),{customerRepository:customers,tagRepository:tags,ctx});
  async function reset(){await db.query('DELETE FROM customer_tag_relation WHERE customer_id=100201');await db.query('DELETE FROM customer_tag WHERE id IN (100011,100021) OR tag_name LIKE $1',['integrity-%']);await db.query("INSERT INTO customer_tag(id,corp_id,tag_name,parent_id) VALUES (100011,1,'integrity-foreign-protected',0),(100021,2,'integrity-own',0)");await db.query("INSERT INTO customer(id,corp_id,external_userid,name) VALUES(100201,2,'tag-integrity-owned','Tag integrity dedicated customer') ON CONFLICT(id) DO NOTHING");}
  async function snapshot(name){result.snapshots.push({name,tags:await db.query('SELECT id,corp_id,tag_name,parent_id FROM customer_tag WHERE id IN (100011,100021) OR tag_name LIKE $1 ORDER BY id',['integrity-%']),relations:await db.query('SELECT customer_id,tag_id FROM customer_tag_relation WHERE customer_id=100201')});}
  async function check(name,run){await reset();await snapshot(name+':before');try{await run();result.checks.push({name,passed:true});}catch(e){result.checks.push({name,passed:false,error:e.message});}await snapshot(name+':after');}
  async function allowRejection(run){try{await run();}catch(e){assert([400,404].includes(e.status),e.message);}}
  await check('update cannot overwrite foreign primary key',async()=>{await allowRejection(()=>controller.update(100021,{id:100011,corpId:1,tagName:'integrity-attacker-update'}));assert.equal((await tags.findOneByOrFail({id:100011})).tagName,'integrity-foreign-protected');});
  await check('normal UI corpId1 cannot move corp2 tag',async()=>{await allowRejection(()=>controller.update(100021,{corpId:1,tagName:'integrity-ui-edit'}));assert.equal(String((await tags.findOneByOrFail({id:100021})).corpId),'2');});
  await check('batch injected ID cannot steal foreign row',async()=>{await allowRejection(()=>controller.batchCreate([{id:100011,tagName:'integrity-attacker-batch',parentId:0}]));const row=await tags.findOneByOrFail({id:100011});assert.equal(String(row.corpId),'1');assert.equal(row.tagName,'integrity-foreign-protected');});
  await check('foreign parent is rejected without creating invisible own child',async()=>{await assert.rejects(()=>service.create({tagName:'integrity-foreign-child',parentId:100011}),e=>[400,404].includes(e.status));assert.equal(await tags.countBy({tagName:'integrity-foreign-child'}),0);});
  await check('invalid parent aborts entire batch',async()=>{await assert.rejects(()=>controller.batchCreate([{tagName:'integrity-batch-valid',parentId:0},{tagName:'integrity-batch-foreign',parentId:100011}]),e=>[400,404].includes(e.status));assert.equal(await tags.countBy({tagName:'integrity-batch-valid'}),0);});
  await check('mixed own and foreign customer tags reject with no partial relation',async()=>{await assert.rejects(()=>customer.addTags(100201,[100021,100011]),e=>[400,404].includes(e.status));assert.equal((await db.query('SELECT * FROM customer_tag_relation WHERE customer_id=100201')).length,0);});
  await check('own customer tag control remains valid and idempotent',async()=>{await customer.addTags(100201,[100021]);await customer.addTags(100201,[100021]);assert.equal((await db.query('SELECT * FROM customer_tag_relation WHERE customer_id=100201 AND tag_id=100021')).length,1);});
  await check('database save failure rolls back the complete batch',async()=>{
    await db.query("ALTER TABLE customer_tag ADD CONSTRAINT integrity_fixture_save_failure CHECK (tag_name <> 'integrity-db-reject')");
    try {
      await assert.rejects(()=>service.batchCreate([{tagName:'integrity-save-first',parentId:0},{tagName:'integrity-db-reject',parentId:0}]));
      assert.equal(await tags.countBy({tagName:'integrity-save-first'}),0);
      assert.equal((await tags.findOneByOrFail({id:100011})).tagName,'integrity-foreign-protected');
    } finally { await db.query('ALTER TABLE customer_tag DROP CONSTRAINT integrity_fixture_save_failure'); }
  });
  result.testsPassed=result.checks.every(c=>c.passed);
 }catch(e){result.error=e.message;result.testsPassed=false;}
 finally{result.cleanup=await cleanup();result.passed=result.testsPassed&&result.cleanup.passed;fs.writeFileSync(path.join(artifactDir,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
