'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const harness=path.join(__dirname,'durable-sop-postgres.sh');
function absentContainer(id){const result=spawnSync('docker',['ps','-a','--no-trunc','--filter',`id=${id}`,'--format','{{.ID}}'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'');}
(async()=>{
 const fault=spawnSync('bash',[harness],{env:{...process.env,DURABLE_SOP_FAULT_START:'1'},encoding:'utf8',timeout:30000});
 assert.notEqual(fault.status,0);const id=fault.stdout.match(/DURABLE_SOP_OWNED_CONTAINER (\S+)/)?.[1];assert(id,fault.stdout+fault.stderr);
 assert.match(fault.stdout,/DURABLE_SOP_CLEANUP container=\S+ passed=true/);absentContainer(id);
 const child=spawn('bash',[harness],{env:{...process.env,DURABLE_SOP_FAULT_HOLD:'1'},stdio:['ignore','pipe','pipe']});
 let output='';let errors='';let ownedWorkers;
 const timeout=setTimeout(()=>{child.kill('SIGTERM');},20000);
 child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/DURABLE_SOP_OWNED_WORKERS (\[[^\n]+\])/);if(match&&!ownedWorkers){ownedWorkers=JSON.parse(match[1]);child.kill('SIGTERM');}});
 child.stderr.on('data',chunk=>{errors+=chunk;});
 const code=await new Promise(resolve=>child.once('exit',resolve));clearTimeout(timeout);
 assert.equal(code,143,output+errors);assert.equal(ownedWorkers?.length,2,output+errors);
 const signalId=output.match(/DURABLE_SOP_OWNED_CONTAINER (\S+)/)?.[1];assert(signalId);absentContainer(signalId);
 assert.match(output,/DURABLE_SOP_CLEANUP container=\S+ passed=true/);
 for(const pid of ownedWorkers)assert.throws(()=>process.kill(pid,0),error=>error.code==='ESRCH',`Worker ${pid} survived owner signal`);
 const {connect}=require('./durable-sop-source.cjs');
 for(const port of ['5432','0','65536','not-a-port']){process.env.DURABLE_SOP_PG_PORT=port;await assert.rejects(connect,/dedicated disposable PG harness/);}
 console.log(JSON.stringify({passed:true,startFailureExit:fault.status,startFailureContainer:id,signalExit:code,signalContainer:signalId,reapedWorkers:ownedWorkers,portGuards:4}));
})().catch(error=>{console.error(error);process.exitCode=1;});
