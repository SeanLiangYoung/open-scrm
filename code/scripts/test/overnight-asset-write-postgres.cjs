'use strict';
// Current source + actual TypeORM + owned PG16. No dist/build/HTTP/external service.
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..'), serviceRoot=path.join(root,'services/asset-service');
const ownRequire=createRequire(path.join(serviceRoot,'package.json'));
const artifact=fs.mkdtempSync(path.join(os.tmpdir(),'open-scrm-asset-write-pg-'));
const result={artifactDir:artifact,checks:[],passed:false};let container,db;let cleanupPromise;
function command(args,options={}){const r=spawnSync('docker',args,{encoding:'utf8',maxBuffer:16*1024*1024,...options});if(r.status!==0)throw new Error(`docker ${args.join(' ')} failed: ${r.stderr||r.error}`);return r.stdout.trim();}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function cleanup(){if(cleanupPromise)return cleanupPromise;cleanupPromise=(async()=>{const errors=[];if(db?.isInitialized)try{await db.destroy();}catch(e){errors.push(e.message);}if(container){const r=spawnSync('docker',['rm','-f',container],{encoding:'utf8'});if(r.status!==0)errors.push(r.stderr||'container removal failed');const q=spawnSync('docker',['ps','-a','--no-trunc','--filter',`id=${container}`,'--format','{{.ID}}'],{encoding:'utf8'});if(q.status!==0||q.stdout.trim())errors.push('owned container absence not confirmed');}return{passed:errors.length===0,errors,containerId:container};})();return cleanupPromise;}
function save(c){fs.writeFileSync(path.join(artifact,'result.json'),JSON.stringify({...result,cleanup:c,passed:result.testsPassed===true&&c.passed},null,2));}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{result.signal=signal;save(await cleanup());process.exit(signal==='SIGINT'?130:143);});
async function main(){console.log(`Artifacts: ${artifact}`);try{
 command(['image','inspect','postgres:16-alpine']);
 container=command(['create','--rm','--name',`open-scrm-asset-write-${process.pid}-${Date.now()}`,'--label','open-scrm.verification=asset-write','--publish','127.0.0.1::5432','--env','POSTGRES_DB=asset_write_pg','--env','POSTGRES_USER=asset_verify','--env','POSTGRES_PASSWORD=disposable_asset_only','postgres:16-alpine']);
 command(['start',container]);
 const port=Number(JSON.parse(command(['inspect',container]))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort);assert(port>1024&&port!==5432);
 for(let i=0;i<60;i++){const r=spawnSync('docker',['exec',container,'pg_isready','-h','127.0.0.1','-U','asset_verify','-d','asset_write_pg']);if(r.status===0)break;if(i===59)throw Error('PG TCP readiness timeout');await pause(250);}
 command(['exec','-i',container,'psql','-v','ON_ERROR_STOP=1','-U','asset_verify','-d','asset_write_pg'],{input:fs.readFileSync(path.join(root,'scripts/init-db.pg.sql'),'utf8')});
 const ts=ownRequire('typescript');require.extensions['.ts']=(module,file)=>{if(!file.startsWith(path.join(serviceRoot,'src')+path.sep))throw Error('Unexpected source');module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,file);};
 const {AssetService}=require(path.join(serviceRoot,'src/service/asset.service.ts'));
 const {AssetCategoryService}=require(path.join(serviceRoot,'src/service/asset-category.service.ts'));
 const {AssetController}=require(path.join(serviceRoot,'src/controller/asset.controller.ts'));
 const {AssetCategoryController}=require(path.join(serviceRoot,'src/controller/asset-category.controller.ts'));
 const {AssetEntity}=require(path.join(serviceRoot,'src/entity/asset.entity.ts'));
 const {AssetCategoryEntity}=require(path.join(serviceRoot,'src/entity/asset-category.entity.ts'));
 const {AssetUsageEntity}=require(path.join(serviceRoot,'src/entity/asset-usage.entity.ts'));
 let externalAttempts=0;
 for(const name of ['node:http','node:https']){const mod=require(name);for(const method of ['request','get'])mod[method]=()=>{externalAttempts++;throw Error('External HTTP blocked');};}
 global.fetch=()=>{externalAttempts++;throw Error('External fetch blocked');};
 const {DataSource}=ownRequire('typeorm');db=new DataSource({type:'postgres',host:'127.0.0.1',port,username:'asset_verify',password:'disposable_asset_only',database:'asset_write_pg',entities:[AssetEntity,AssetCategoryEntity,AssetUsageEntity],synchronize:false,extra:{application_name:'asset-write-source-probe'}});await db.initialize();result.pgPort=port;
 const assetRepo=db.getRepository(AssetEntity),categoryRepo=db.getRepository(AssetCategoryEntity);
 const service=Object.assign(new AssetService(),{assetRepository:assetRepo,categoryRepository:categoryRepo,usageRepository:db.getRepository(AssetUsageEntity),ossService:{put(){externalAttempts++;throw Error('OSS blocked');},delete(){externalAttempts++;throw Error('OSS blocked');}}});
 const categories=Object.assign(new AssetCategoryService(),{categoryRepository:categoryRepo});
 const ctx={state:{user:{corpId:901,userId:9001}},get:()=>''};
 const controller=Object.assign(new AssetController(),{ctx,assetService:service});const categoryController=Object.assign(new AssetCategoryController(),{ctx,assetCategoryService:categories});
 await db.query(`INSERT INTO asset_category(id,corp_id,parent_id,name) VALUES(31,901,0,'root'),(32,901,31,'child'),(33,902,0,'foreign'),(34,901,0,'empty');
 INSERT INTO asset(id,corp_id,category_id,name,type,file_url) VALUES(71,901,31,'own',1,'https://invalid.local/own'),(72,902,33,'foreign',1,'https://invalid.local/foreign'),(9007199254740991,901,31,'safeMAX',1,'https://invalid.local/max');`);
 const check=async(name,fn)=>{await fn();result.checks.push(name);console.log('PASS '+name);};
 const state=async()=>{const [r]=await db.query('SELECT use_count,(SELECT count(*)::int FROM asset_usage WHERE asset_id=71) AS receipts FROM asset WHERE id=71');return r;};
 await check('PG16 actual metadata and BIGINT safeMAX lookup',async()=>{const [v]=await db.query('SHOW server_version_num');assert(Number(v.server_version_num)>=160000&&Number(v.server_version_num)<170000);assert.equal((await controller.getAsset('9007199254740991')).data.id,'9007199254740991');});
 await check('invalid asset/category paths reject before SQL updates',async()=>{for(const id of ['1e0','0x47','071','71tail','0','9007199254740992'])await assert.rejects(()=>controller.updateAsset(id,{name:'bad'}),e=>e.status===400);await assert.rejects(()=>categoryController.deleteCategory('2147483648'),e=>e.status===400);assert.equal((await service.getAssetById(901,71)).name,'own');});
 await check('foreign and missing categories reject without changing local asset',async()=>{for(const id of [33,999])await assert.rejects(()=>service.updateAsset(901,71,{categoryId:id}),e=>e.status===400);assert.equal((await service.getAssetById(901,71)).categoryId,31);});
 await check('valid category update preserves omitted name and foreign target rejects',async()=>{await service.updateAsset(901,71,{categoryId:32});assert.equal((await service.getAssetById(901,71)).name,'own');await assert.rejects(()=>service.updateAsset(901,72,{name:'bad'}),e=>e.status===404);assert.equal((await service.getAssetById(902,72)).name,'foreign');});
 await check('foreign parent and hierarchy cycles reject atomically',async()=>{await assert.rejects(()=>categories.createCategory(901,{name:'bad',parentId:33}),e=>e.status===400);await assert.rejects(()=>categories.updateCategory(901,31,{parentId:32}),e=>e.status===400);assert.equal((await categoryRepo.findOneBy({id:31})).parentId,0);});
 await check('root creation and local parent update work',async()=>{const root=await categories.createCategory(901,{name:'new root',parentId:0});await categories.updateCategory(901,root.id,{parentId:31});assert.equal((await categoryRepo.findOneBy({id:root.id})).parentId,31);});
 await check('referenced categories refuse deletion while empty category can be deleted',async()=>{for(const id of [31,32])await assert.rejects(()=>categories.deleteCategory(901,id),e=>e.status===400);await categories.deleteCategory(901,34);assert.equal(await categoryRepo.findOneBy({id:34}),null);});
 await check('foreign/missing usage does not persist orphan rows',async()=>{for(const id of [72,999])await assert.rejects(()=>service.recordUsage(901,{assetId:id,useType:'message'},9001),e=>e.status===404);assert.equal(await db.getRepository(AssetUsageEntity).count(),0);});
 await check('30 concurrent usage writes preserve exact count and receipts',async()=>{await Promise.all(Array.from({length:30},()=>service.recordUsage(901,{assetId:71,useType:'message'},9001)));assert.deepEqual(await state(),{use_count:30,receipts:30});});
 await check('usage insert failure rolls back with count unchanged',async()=>{await db.query("ALTER TABLE asset_usage ADD CONSTRAINT asset_usage_failure CHECK(use_type <> 'controlled_failure')");await assert.rejects(()=>service.recordUsage(901,{assetId:71,useType:'controlled_failure'},9001),e=>e.driverError?.code==='23514');assert.deepEqual(await state(),{use_count:30,receipts:30});await db.query('ALTER TABLE asset_usage DROP CONSTRAINT asset_usage_failure');});
 await check('counter failure rolls back newly inserted usage',async()=>{await db.query('ALTER TABLE asset ADD CONSTRAINT asset_counter_failure CHECK(use_count <= 30)');await assert.rejects(()=>service.recordUsage(901,{assetId:71,useType:'message'},9001),e=>e.driverError?.code==='23514');assert.deepEqual(await state(),{use_count:30,receipts:30});await db.query('ALTER TABLE asset DROP CONSTRAINT asset_counter_failure');});
 await check('concurrent opposite parent changes cannot commit a cycle',async()=>{const a=await categories.createCategory(901,{name:'A'}),b=await categories.createCategory(901,{name:'B'});const outcomes=await Promise.allSettled([categories.updateCategory(901,a.id,{parentId:b.id}),categories.updateCategory(901,b.id,{parentId:a.id})]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.filter(r=>r.status==='rejected'&&r.reason.status===400).length,1);});
 await check('category deletion blocks concurrent reassignment then rejects without orphan',async()=>{
  await db.query("INSERT INTO asset_category(id,corp_id,parent_id,name) VALUES(35,901,0,'deleting')");
  const deleter=db.createQueryRunner();await deleter.connect();await deleter.startTransaction();let pending;
  try{
   await deleter.query('DELETE FROM asset_category WHERE id=35');
   pending=service.updateAsset(901,71,{categoryId:35}).then(()=>({success:true}),error=>({error}));
   let blocked=false;
   for(let i=0;i<100;i++){
    const [row]=await db.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='asset-write-source-probe' AND query ILIKE '%asset_category%' AND query ILIKE '%FOR SHARE%' AND cardinality(pg_blocking_pids(pid))>0) AS blocked");
    if(row.blocked){blocked=true;break;}await pause(20);
   }
   assert(blocked,'Expected real category row lock wait');await deleter.commitTransaction();
   const outcome=await pending;assert.equal(outcome.error?.status,400);assert.equal((await service.getAssetById(901,71)).categoryId,32);
   result.categoryDeleteRace='observed FOR SHARE wait, 400 after deletion commits, original category32 preserved';
  }finally{if(deleter.isTransactionActive)await deleter.rollbackTransaction();if(pending)await pending;await deleter.release();}
 });
 assert.equal(externalAttempts,0);result.externalAttempts=externalAttempts;result.checkCount=result.checks.length;result.finalUsage=await state();result.testsPassed=true;
 }catch(error){result.error=error.message;throw error;}finally{const c=await cleanup();save(c);if(!c.passed)throw Error(`Cleanup failed: ${c.errors.join('; ')}`);console.log('Owned PostgreSQL removed and absence confirmed.');}}
main().catch(error=>{console.error(error);process.exitCode=1;});
