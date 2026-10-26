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
 const red = process.argv.includes('--red');
 const actors = [];
 const releaseOnSignal = [];
 const artifactDir=fs.mkdtempSync(path.join(os.tmpdir(),'open-scrm-tag-name-concurrency-pg-')),result={artifactDir,scope:'actual PostgreSQL16 and current TypeORM/controller/services; no Bootstrap/build/HTTP',checks:[],snapshots:[]};
 let containerId,db;console.log(`Artifacts: ${artifactDir}`);
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 let cleanupPromise;
 const cleanup=()=>cleanupPromise ||= (async()=>{const errors=[];for(const actor of actors)if(actor.isInitialized)try{await actor.destroy();}catch(e){errors.push(e.message);}if(db?.isInitialized)try{await db.destroy();}catch(e){errors.push(e.message);}if(containerId){const removed=spawnSync('docker',['rm','-f',containerId],{encoding:'utf8'});if(removed.status!==0)errors.push(removed.stderr||'removal failed');const remaining=spawnSync('docker',['ps','-a','--no-trunc','--filter',`id=${containerId}`,'--format','{{.ID}}'],{encoding:'utf8'});if(remaining.status!==0||remaining.stdout.trim())errors.push('Owned container absence not verified');}return{passed:errors.length===0,errors,containerId};})();
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{result.signal=signal;for(const release of releaseOnSignal)release();result.testsPassed=false;result.cleanup=await cleanup();result.passed=false;fs.writeFileSync(path.join(artifactDir,'result.json'),JSON.stringify(result,null,2));process.exit(signal==='SIGINT'?130:143);});
 try{
  command('docker',['image','inspect','postgres:16-alpine']);
  containerId=command('docker',['create','--rm','--name',`open-scrm-tag-name-concurrency-pg-${process.pid}-${Date.now()}`,'--label','open-scrm.verification=tag-name-concurrency-pg','--publish','127.0.0.1::5432','--env','POSTGRES_DB=tag_name_concurrency','--env','POSTGRES_USER=tag_name_verify','--env','POSTGRES_PASSWORD=disposable_tag_name_only','postgres:16-alpine']);
  command('docker',['start',containerId]);
  const port=Number(JSON.parse(command('docker',['inspect',containerId]))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort);result.port=port;
  let ready=false;for(let i=0;i<60;i++){if(spawnSync('docker',['exec',containerId,'pg_isready','-h','127.0.0.1','-U','tag_name_verify','-d','tag_name_concurrency'],{stdio:'ignore'}).status===0){ready=true;break;}await wait(300);}assert(ready,'Dedicated PG startup timed out');
  command('docker',['exec','-i',containerId,'psql','-v','ON_ERROR_STOP=1','-U','tag_name_verify','-d','tag_name_concurrency'],{input:fs.readFileSync(path.join(root,'scripts/init-db.pg.sql'),'utf8')});
  db=new DataSource({type:'postgres',host:'127.0.0.1',port,username:'tag_name_verify',password:'disposable_tag_name_only',database:'tag_name_concurrency',entities:[TagEntity,CustomerEntity],synchronize:false});await db.initialize();
  const [version]=await db.query("SELECT current_setting('server_version_num')::int AS version");assert.equal(Math.floor(version.version/10000),16);result.pgVersion=version.version;
  result.mode=red?'pre-fix synchronized empty-name reads':'post-fix observed advisory wait';
  const tags=db.getRepository(TagEntity);
  const ctx={get:key=>({'x-corp-id':'2','x-user-id':'7'})[key]||''};
  const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
  for(const mode of [...['create/create','create/batch','rename/create'],...(!red?['reverse-parent']:[])]){
    if(result.signal)break;
    const parentMode=mode==='reverse-parent';
    const target='name-race-'+mode.replace('/','-');
    await db.query('DELETE FROM customer_tag WHERE corp_id=2 AND (tag_name LIKE $1 OR id=200001)',['name-race-%']);
    if(mode==='rename/create')await db.query("INSERT INTO customer_tag(id,corp_id,tag_name,parent_id) VALUES(200001,2,'name-race-original',0)");
    if(parentMode)await db.query("INSERT INTO customer_tag(id,corp_id,tag_name,parent_id) VALUES(200011,2,'name-race-parent-A',0),(200012,2,'name-race-parent-B',0)");
    const beforeTagCount=await tags.countBy({corpId:2});
    const pair=[new DataSource({...db.options}),new DataSource({...db.options})];for(const actor of pair){actors.push(actor);await actor.initialize();}
    const reached=deferred(),release=deferred(),secondReady=deferred();let arrivals=0,secondPid;
    releaseOnSignal.push(release.resolve);
    const trace=[];
    const redTimer=red?setTimeout(()=>{trace.push({event:'bounded RED barrier expired; current source may already serialize'});release.resolve();},5000):undefined;
    for(const [index,actor]of pair.entries()){
      const transaction=actor.manager.transaction.bind(actor.manager);
      actor.manager.transaction=async callback=>transaction(async manager=>{
        const [{pid}]=await manager.query('SELECT pg_backend_pid() AS pid');trace.push({actor:index,pid,event:'transaction begun'});
        if(index===1){secondPid=pid;secondReady.resolve();}
        const original=manager.getRepository.bind(manager);manager.getRepository=entity=>{
          const repository=original(entity);
          if(entity===TagEntity){
            const find=repository.findOne.bind(repository);repository.findOne=async options=>{
              const value=await find(options);
              if(red&&options.where?.tagName===target&&!value){trace.push({actor:index,event:'empty name observed'});arrivals++;if(arrivals===2){reached.resolve();release.resolve();}await release.promise;}
              return value;
            };
            const save=repository.save.bind(repository);repository.save=async input=>{
              const value=await save(input);
              if(!red&&index===0){trace.push({actor:index,event:'saved but not committed'});reached.resolve();await release.promise;}
              return value;
            };
          }return repository;
        };return callback(manager);
      });
    }
    const services=pair.map(actor=>Object.assign(new TagService(),{tagRepository:actor.getRepository(TagEntity),ctx}));
    const first=parentMode?()=>services[0].update(200011,{parentId:200012}):mode==='rename/create'?()=>services[0].update(200001,{tagName:target}):()=>services[0].create({tagName:target,parentId:0});
    const second=parentMode?()=>services[1].update(200012,{parentId:200011}):mode==='create/batch'?()=>services[1].batchCreate([{tagName:target,parentId:0},{tagName:target+'-extra',parentId:0}]):()=>services[1].create({tagName:target,parentId:0});
    const p1=first().then(value=>({ok:true,value}),error=>({ok:false,status:error.status,message:error.message}));
    let p2;
    try{
      if(red){p2=second().then(value=>({ok:true,value}),error=>({ok:false,status:error.status,message:error.message}));}
      else{
        await Promise.race([reached.promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('First transaction never reached save barrier')),5000))]);
        p2=second().then(value=>({ok:true,value}),error=>({ok:false,status:error.status,message:error.message}));await secondReady.promise;
        let lockWait;
        for(let attempt=0;attempt<100;attempt++){
          const [activity]=await db.query('SELECT wait_event_type,wait_event,query,state FROM pg_stat_activity WHERE pid=$1',[secondPid]);
          if(activity?.wait_event_type==='Lock'&&activity.wait_event==='advisory'){lockWait=activity;break;}await wait(20);
        }
        assert(lockWait,'Second connection must actually wait on the tenant advisory lock');trace.push({actor:1,event:'pg_stat_activity confirmed advisory wait',...lockWait});release.resolve();
      }
      const outputs=await Promise.all([p1,p2]);
      const rows=parentMode?await db.query('SELECT id,corp_id,tag_name,parent_id FROM customer_tag WHERE id IN(200011,200012) ORDER BY id'):await db.query('SELECT id,corp_id,tag_name FROM customer_tag WHERE corp_id=2 AND tag_name IN($1,$2) ORDER BY id',[target,target+'-extra']);
      const own=rows.filter(row=>row.tag_name===target),extra=rows.filter(row=>row.tag_name===target+'-extra');
      result.snapshots.push({mode,beforeTagCount,outputs,rows,trace});
      const passed=(!red||arrivals===2)&&outputs[0].ok&&outputs[1].ok===false&&outputs[1].status===400&&(parentMode?(rows[0].parent_id===200012&&rows[1].parent_id===0):(own.length===1&&extra.length===0));
      result.checks.push({name:mode,passed});
    }catch(error){result.checks.push({name:mode,passed:false,error:error.message});}
    finally{if(redTimer)clearTimeout(redTimer);release.resolve();if(p2)await Promise.all([p1,p2]);for(const actor of pair)if(actor.isInitialized)await actor.destroy();}
  }
  result.testsPassed=result.checks.every(c=>c.passed);
 }catch(e){result.error=e.message;result.testsPassed=false;}
 finally{result.cleanup=await cleanup();result.passed=result.testsPassed&&result.cleanup.passed&&!result.signal;fs.writeFileSync(path.join(artifactDir,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
