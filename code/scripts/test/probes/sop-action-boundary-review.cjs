'use strict';
// Read current TypeScript methods; framework/DB/HTTP adapters are inert in-memory fixtures.
// No imports of runtime config, no Bootstrap, no dist or registered spec changes.
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..');
const ownRequire=createRequire(path.join(root,'services/operation-service/package.json'));
const ts=ownRequire('typescript');
const noDecorator=()=>()=>{};
const core={Provide:()=>target=>target,Inject:noDecorator,Config:noDecorator,httpError:ownRequire('@midwayjs/core').httpError};
function load(relative,name){const filename=path.join(root,relative);const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:false}}).outputText;const module={exports:{}};vm.runInNewContext(output,{module,exports:module.exports,require:id=>{
 if(id==='../util/sop-action-validation')return load('services/operation-service/src/util/sop-action-validation.ts');
 if(id==='@midwayjs/core')return core;if(id==='@midwayjs/typeorm')return{InjectEntityModel:noDecorator};if(id==='typeorm')return{In:values=>({_value:values})};if(id==='@scrm/server-common')return{getTenantContext:()=>({corpId:2,userId:7})};return new Proxy({},{get:()=>class FixtureType{}});
},console,Date,Number,Array,Object,Map,Set,Promise,setTimeout,clearTimeout},{filename});return name ? module.exports[name] : module.exports;}
const Sop=load('services/operation-service/src/service/sop-execution.service.ts','SopExecutionService');
const Notification=load('services/message-service/src/service/notification.service.ts','NotificationService');
let notificationSchema;
const Customer=load('services/customer-service/src/service/customer.service.ts','CustomerService');
async function run(step){const customer={id:10,corpId:2,followUserId:7,tags:[]};const client=new Customer();client.customerRepository={findOne:async()=>customer,save:async row=>row,query:async(_sql,args)=>args[0]===1&&args[1]===2?[{id:1}]:[]};client.tagRepository={findBy:async()=>[]};
 const notifications=[];const notification=new Notification();notification.notificationConfig={defaultExpireDays:30};notification.notificationRepository={manager:{transaction:async fn=>fn({query:async()=>[{id:1}],getRepository:()=>({create:row=>row,save:async rows=>{notifications.push(...rows);return rows;}})})}};
 const row={id:991,corpId:2,targetType:1,customerId:10,status:0,currentStep:0,executionLog:[]};const calls=[];const service=new Sop();service.executionRepository={findOne:async()=>({...row}),update:async(where,patch)=>{if(where.status!==undefined&&where.status!==row.status)return{affected:0};Object.assign(row,patch);return{affected:1};}};service.servicesConfig={customer:'fixture://customer',message:'fixture://message'};service.httpService={put:async(url,body)=>{calls.push({url,body});await client.update(10,body);return{data:{success:true}};},post:async(url,body)=>{calls.push({url,body});if(url.endsWith('/tags'))await client.addTags(10,body.tagIds);if(url.endsWith('/api/notification/')){const validated=notificationSchema.validate(body);if(validated.error)throw validated.error;await notification.createNotification(2,validated.value);}return{data:{success:true}};}};await service.executeSteps(row.id,[{stepName:'review fixture',delayTime:0,delayUnit:'minute',...step}]);return{row,customer,calls,notifications};}
(async()=>{
 const evidence=[];
 const dtoFile=path.join(root,'services/operation-service/src/dto/sop-step.dto.ts');
 const dtoJs=ts.transpileModule(fs.readFileSync(dtoFile,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:false}}).outputText;
 const dtoModule={exports:{}};vm.runInNewContext(dtoJs,{module:dtoModule,exports:dtoModule.exports,require:id=>id==='../util/sop-action-validation'?load('services/operation-service/src/util/sop-action-validation.ts'):ownRequire(id)});
 const {getSchema}=ownRequire('@midwayjs/validate');
 const nf=path.join(root,'services/message-service/src/dto/notification.dto.ts');const nm={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(nf,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText,{module:nm,exports:nm.exports,require:ownRequire});
 notificationSchema=getSchema(nm.exports.CreateNotificationDto);

 for(const configuration of [{followUserId:true},{followUserId:'0x1'},{followUserId:[1]}]){
   const check=getSchema(dtoModule.exports.BatchCreateStepsDto).validate({templateId:3,steps:[{stepOrder:1,stepName:'review',stepType:4,delayTime:-3,actionContent:configuration}]});
   assert.equal(check.error,undefined);evidence.push({case:'actual nested BatchCreateStepsDto schema accepts malformed action and negative delay',configuration});
 }

 for(const value of [true,'1e0','0x1',[1]]){const result=await run({stepType:4,actionContent:{followUserId:value}});assert.equal(result.customer.followUserId,1);assert.equal(result.row.status,1);evidence.push({case:'malformed assignee silently converts to enabled samecorp employee1',configured:value,submitted:result.calls[0].body,status:result.row.status,currentStep:result.row.currentStep});}
 const notice=await run({stepType:5,actionContent:{userIds:['1e0'],content:'review notification'}});
 assert.equal(notice.notifications.length,1);assert.equal(notice.notifications[0].userId,1);assert.equal(notice.row.status,1);
 evidence.push({case:'noncanonical notification recipient string 1e0 coerced by actual DTO to employee1',configured:['1e0'],persistedUserId:notice.notifications[0].userId,status:notice.row.status});
 const tags=await run({stepType:2,actionContent:{tagIds:[9999]}});assert.equal(tags.customer.tags.length,0);assert.equal(tags.row.status,1);evidence.push({case:'missing/foreign tag query returns no tags yet step completed',status:tags.row.status,currentStep:tags.row.currentStep,tagCount:tags.customer.tags.length});
 const delay=await run({stepType:4,delayTime:-3,actionContent:{followUserId:1}});assert.equal(delay.row.status,1);assert.equal(delay.customer.followUserId,1);evidence.push({case:'negative delay skipped and assignment completed immediately',status:delay.row.status,submitted:delay.calls[0].body});
 console.log(JSON.stringify({source:'current TypeScript method probes',framework:'inert decorators; memory repository and HTTP adapters',externalConnections:0,evidence},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
