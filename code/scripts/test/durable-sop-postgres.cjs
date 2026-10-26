'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {fork}=require('node:child_process');
const {connect,SopExecutionService,SopExecutionEntity,LEGACY_SOP_REASON,UNKNOWN_SOP_REASON}=require('./durable-sop-source.cjs');
const migration=fs.readFileSync(path.join(__dirname,'../migrations/2026-10-26-durable-sop-scheduling.pg.sql'),'utf8');
const children=new Set();
let activeDb;let shuttingDown=false;
async function shutdown(code){
 if(shuttingDown)return;shuttingDown=true;
 await Promise.all([...children].map(kill));
 if(activeDb?.isInitialized)await activeDb.destroy();
 process.exit(code);
}
process.on('SIGTERM',()=>{shutdown(143).catch(error=>{console.error(error);process.exit(1);});});
process.on('SIGINT',()=>{shutdown(130).catch(error=>{console.error(error);process.exit(1);});});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){const deadline=Date.now()+10000;while(Date.now()<deadline){const value=await check();if(value)return value;await sleep(20);}throw new Error(`Timed out: ${label}`);}
async function worker(mode='normal'){
 const child=fork(path.join(__dirname,'durable-sop-worker.cjs'),[],{env:{...process.env,DURABLE_SOP_MODE:mode},stdio:['ignore','pipe','pipe','ipc']});
 child.events=[];child.logs='';children.add(child);
 child.on('message',message=>child.events.push(message));child.stdout.on('data',chunk=>{child.logs+=chunk;});child.stderr.on('data',chunk=>{child.logs+=chunk;});
 child.on('exit',()=>children.delete(child));
 await until(()=>{if(child.exitCode!==null)throw new Error(child.logs);return child.events.some(e=>e.event==='ready');},'worker ready');
 return child;
}
async function kill(child){if(child.exitCode!==null||child.signalCode!==null)return;const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await exited;}
(async()=>{
 const {db,store}=await connect();activeDb=db;const checks=[];
 const check=async(name,run)=>{await run();checks.push(name);console.log(`PASS ${name}`);};
 const row=async id=>(await db.query('SELECT * FROM sop_execution WHERE id=$1',[id]))[0];
 const receipts=async id=>Number((await db.query('SELECT count(*) FROM durable_receipt WHERE execution_id=$1',[id]))[0].count);
 const steps=(delay=0,unit='minute')=>[{stepName:'message',stepType:1,delayTime:delay,delayUnit:unit,actionContent:{content:'frozen original'}}];
 const enqueue=async(snapshot=steps())=>store.enqueue({corpId:901,templateId:3,templateName:'durable',targetType:1,customerId:10},snapshot);
 const expire=async id=>db.query("UPDATE sop_execution SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[id]);
 const control=Object.assign(new SopExecutionService(),{executionRepository:db.getRepository(SopExecutionEntity),scheduleStore:store,sopTemplateService:{getTemplate:async()=>({id:3,status:1,templateType:1,steps:steps()})}});
 try{
  await db.query(`CREATE TABLE sop_execution(id BIGSERIAL PRIMARY KEY,corp_id BIGINT NOT NULL,template_id INT NOT NULL,template_name VARCHAR(100),target_type SMALLINT NOT NULL,customer_id BIGINT,group_id BIGINT,current_step INT DEFAULT 0,total_steps INT DEFAULT 0,status SMALLINT DEFAULT 0,start_time TIMESTAMP,complete_time TIMESTAMP,error_message VARCHAR(500),execution_log JSONB,create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await db.query('CREATE TABLE durable_receipt(id BIGSERIAL PRIMARY KEY,execution_id BIGINT,step INT,content TEXT,worker_pid INT,created_at TIMESTAMPTZ DEFAULT clock_timestamp())');
  await check('migration terminates legacy running and paused rows once, preserving progress/logs',async()=>{
   await db.query(`INSERT INTO sop_execution(corp_id,template_id,target_type,status,current_step,execution_log) VALUES(901,3,1,0,1,'[{"step":1,"status":"success"}]'),(901,3,1,2,1,'[{"step":1,"status":"success"}]'),(901,3,1,1,1,'[]'),(901,3,1,3,0,'[]')`);
   await db.query(migration);await db.query(migration);
   const rows=await db.query('SELECT * FROM sop_execution ORDER BY id');
   assert.deepEqual(rows.map(r=>r.status),[3,3,1,3]);
   for(const r of rows.slice(0,2)){assert.equal(r.error_message,LEGACY_SOP_REASON);assert.equal(r.current_step,1);assert.equal(r.execution_log.length,2);}
   assert.equal(await receipts(rows[0].id),0);
  });
  if(process.env.DURABLE_SOP_FAULT_HOLD==='1'){
   const [a,b]=await Promise.all([worker(),worker()]);
   console.log(`DURABLE_SOP_OWNED_WORKERS ${JSON.stringify([a.pid,b.pid])}`);
   await new Promise(()=>{});
  }
  await check('invalid persisted template still creates failed execution history without dispatch',async()=>{
   for(const invalid of [steps(-1),[{...steps()[0],stepType:4,actionContent:{followUserId:true}}]]){
    const saved=await enqueue(invalid);const persisted=await row(saved.id);
    assert.equal(saved.status,3);assert.equal(persisted.status,3);assert.equal(persisted.current_step,0);
    assert.equal(persisted.next_run_at,null);assert.equal(persisted.execution_log[0].status,'failed');
    assert.equal(await receipts(saved.id),0);
   }
  });
  await check('365-day absolute deadline and immutable snapshot persist; no long Node timer',async()=>{
   const snapshot=steps(365,'day');const saved=await enqueue(snapshot);snapshot[0].actionContent.content='mutated';
   const [timing]=await db.query('SELECT extract(epoch from (next_run_at-start_time))*1000 AS ms FROM sop_execution WHERE id=$1',[saved.id]);
   assert(Math.abs(Number(timing.ms)-365*86400000)<10);assert.equal((await row(saved.id)).steps_snapshot[0].actionContent.content,'frozen original');
   const claimed=await store.claim(10,900);assert(!claimed.some(r=>r.id===saved.id));
   await db.query('UPDATE sop_execution SET status=3 WHERE id=$1',[saved.id]);
  });
  await check('waiting worker OS restart preserves deadline and fires only after due',async()=>{
   const saved=await enqueue(steps(1));await db.query("UPDATE sop_execution SET next_run_at=clock_timestamp()+interval '3 seconds' WHERE id=$1",[saved.id]);
   const due=(await row(saved.id)).next_run_at;const a=await worker();assert.equal(await receipts(saved.id),0);await kill(a);
   const b=await worker();assert.equal(+(await row(saved.id)).next_run_at,+due);assert.equal(await receipts(saved.id),0);
   await until(async()=>await receipts(saved.id)===1,'restarted due action');
   const [receipt]=await db.query('SELECT * FROM durable_receipt WHERE execution_id=$1',[saved.id]);assert(+receipt.created_at>=+due);
   await until(async()=>(await row(saved.id)).status===1,'restarted completion');await kill(b);
  });
  await check('row saved without local kick is picked up by two OS workers only once',async()=>{
   const saved=await enqueue();const a=await worker('hold');const b=await worker();
   await until(async()=>await receipts(saved.id)===1,'single receipt');await sleep(250);assert.equal(await receipts(saved.id),1);
   a.send('release');await until(async()=>(await row(saved.id)).status===1,'claim completion');await kill(a);await kill(b);
  });
  await check('already-running independent workers compete for newly inserted due work',async()=>{
   const [a,b]=await Promise.all([worker('hold'),worker('hold')]);
   const saved=await enqueue();await until(async()=>await receipts(saved.id)===1,'competing receipt');
   await sleep(250);assert.equal(await receipts(saved.id),1);a.send('release');b.send('release');
   await until(async()=>(await row(saved.id)).status===1,'competing completion');await kill(a);await kill(b);
  });
  await check('expired pre-action claim is recovered and stale token cannot record progress',async()=>{
   const saved=await enqueue();const a=await worker('before-marker');await until(()=>a.events.some(e=>e.event==='claimed'),'claimed pre-action');
   const stale=await row(saved.id);await kill(a);await expire(saved.id);const b=await worker();
   await until(async()=>(await row(saved.id)).status===1,'reclaimed completion');
   await store.finish({id:saved.id,corpId:901,currentStep:0,leaseToken:stale.lease_token,stepsSnapshot:steps()},undefined);
   assert.equal((await row(saved.id)).current_step,1);assert.equal((await row(saved.id)).execution_log.length,1);assert.equal(await receipts(saved.id),1);await kill(b);
  });
  for(const [mode,event,count] of [['after-marker','marked',0],['after-receipt','receipt',1]])await check(`${mode} OS crash fails unknown outcome closed, no replay`,async()=>{
   const saved=await enqueue();const a=await worker(mode);await until(()=>a.events.some(e=>e.event===event),event);await kill(a);await expire(saved.id);const b=await worker();
   await until(async()=>(await row(saved.id)).status===3,'failed closed');assert.equal((await row(saved.id)).error_message,UNKNOWN_SOP_REASON);assert.equal((await row(saved.id)).current_step,0);assert.equal(await receipts(saved.id),count);
   await sleep(250);assert.equal(await receipts(saved.id),count);await kill(b);
  });
  await check('pause/resume during in-flight action retains ownership and never dispatches twice',async()=>{
   const saved=await enqueue();const a=await worker('hold');await until(async()=>await receipts(saved.id)===1,'held receipt');
   await control.controlExecution(901,saved.id,'pause');const due=(await row(saved.id)).next_run_at;
   await control.controlExecution(901,saved.id,'resume');assert.equal(+(await row(saved.id)).next_run_at,+due);
   const b=await worker();await sleep(200);assert.equal(await receipts(saved.id),1);a.send('release');await until(async()=>(await row(saved.id)).status===1,'resumed completion');await kill(a);await kill(b);
  });
  await check('late final success preserves pause, then resume completes without replay',async()=>{
   const saved=await enqueue();const a=await worker('hold');await until(async()=>await receipts(saved.id)===1,'held final');
   await control.controlExecution(901,saved.id,'pause');a.send('release');await until(async()=>(await row(saved.id)).current_step===1,'paused progress');
   assert.equal((await row(saved.id)).status,2);await control.controlExecution(901,saved.id,'resume');
   assert.equal((await row(saved.id)).status,1);assert.equal(await receipts(saved.id),1);await kill(a);
  });
  await check('cancel in-flight preserves terminal status while recording confirmed progress',async()=>{
   const saved=await enqueue();const a=await worker('hold');await until(async()=>await receipts(saved.id)===1,'held cancellation');
   await control.controlExecution(901,saved.id,'cancel');a.send('release');await until(async()=>(await row(saved.id)).current_step===1,'cancelled progress');assert.equal((await row(saved.id)).status,3);assert.equal(await receipts(saved.id),1);await kill(a);
  });
  await check('paused action failure cannot resume/replay and retains original evidence',async()=>{
   const saved=await enqueue();const [claimed]=await store.claim(1,900);assert.equal(claimed.id,saved.id);
   assert.equal(await store.markAction(claimed),true);await control.controlExecution(901,saved.id,'pause');
   await store.finish(claimed,new Error('downstream result uncertain'));
   assert.equal((await row(saved.id)).status,2);await control.controlExecution(901,saved.id,'resume');
   assert.equal((await row(saved.id)).status,3);assert.equal((await row(saved.id)).error_message,'downstream result uncertain');
   assert.equal(await receipts(saved.id),0);
  });
  await check('migration reapplied after new data preserves completed pause and action failure evidence',async()=>{
   const completed=await enqueue();const failed=await enqueue();
   await db.query("UPDATE sop_execution SET status=2,current_step=1,next_run_at=NULL WHERE id=$1",[completed.id]);
   await db.query("UPDATE sop_execution SET status=2,next_run_at=NULL,error_message='real failed action' WHERE id=$1",[failed.id]);
   await db.query(migration);await db.query(migration);
   assert.equal((await row(completed.id)).status,2);assert.equal((await row(failed.id)).status,2);
   assert.equal((await row(failed.id)).error_message,'real failed action');
   await control.controlExecution(901,completed.id,'resume');assert.equal((await row(completed.id)).status,1);
   await store.recover(10);assert.equal((await row(failed.id)).status,3);assert.equal((await row(failed.id)).error_message,'real failed action');
  });
  await check('pause/cancel before due and other-tenant control never dispatch',async()=>{
   const paused=await enqueue();const cancelled=await enqueue();await control.controlExecution(901,paused.id,'pause');await control.controlExecution(901,cancelled.id,'cancel');
   assert.equal((await control.controlExecution(902,paused.id,'resume')).count,0);const a=await worker();await sleep(250);assert.equal(await receipts(paused.id),0);assert.equal(await receipts(cancelled.id),0);await kill(a);
   await db.query('UPDATE sop_execution SET status=3 WHERE id=$1',[paused.id]);
  });
  console.log(JSON.stringify({scope:'current-source PG16 + actual OS worker restart/claims, controlled DB receipt side effects; no real sends',passed:checks.length,checks},null,2));
 }finally{await Promise.all([...children].map(kill));await db.destroy();}
})().catch(error=>{console.error(error);process.exitCode=1;});
