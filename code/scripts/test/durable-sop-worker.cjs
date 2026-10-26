'use strict';
const {connect,SopScheduler}=require('./durable-sop-source.cjs');
// Test workers must never outlive the owning harness, including held effects.
process.on('disconnect',()=>process.exit(1));
process.on('SIGTERM',()=>process.exit(143));
process.on('SIGINT',()=>process.exit(130));
(async()=>{
 const {db,store}=await connect();
 const hang=()=>new Promise(()=>{});
 const mode=process.env.DURABLE_SOP_MODE;
 if(mode==='before-marker'){
  const original=store.markAction.bind(store);
  store.markAction=async row=>{process.send?.({event:'claimed',id:row.id});await hang();return original(row);};
 }
 if(mode==='after-marker'){
  const original=store.markAction.bind(store);
  store.markAction=async row=>{const marked=await original(row);if(marked){process.send?.({event:'marked',id:row.id});await hang();}return marked;};
 }
 const actionService={executeStep:async(row,step)=>{
  await db.query('INSERT INTO durable_receipt(execution_id,step,content,worker_pid) VALUES($1,$2,$3,$4)',[row.id,row.currentStep+1,step.actionContent.content,process.pid]);
  process.send?.({event:'receipt',id:row.id});
  if(mode==='after-receipt')await hang();
  if(mode==='hold')await new Promise(resolve=>process.once('message',message=>{if(message==='release')resolve();}));
 }};
 const scheduler=Object.assign(new SopScheduler(),{scheduleStore:store,actionService,schedulerConfig:{pollMs:100,leaseMs:900,maxConcurrent:1}});
 process.send?.({event:'ready'});scheduler.start();
 process.on('message',async message=>{if(message==='stop'){await scheduler.stop();await db.destroy();process.exit(0);}});
})().catch(error=>{console.error(error);process.exit(1);});
