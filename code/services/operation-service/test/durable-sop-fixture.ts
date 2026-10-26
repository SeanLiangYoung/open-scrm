import { vi } from 'vitest';
import { SopExecutionService } from '../src/service/sop-execution.service';
import { SopActionService } from '../src/service/sop-action.service';
import { SopScheduler } from '../src/service/sop-scheduler.service';
import { sopDelayMs } from '../src/util/sop-action-validation';

/** In-memory boundary fixture; SQL/concurrency/restart assertions live in PG harness. */
export function durableFixture(steps: any[], patch: Record<string, any> = {}) {
  let row: any = { id: 1, corpId: 2, templateId: 3, targetType: 1, customerId: 10,
    status: 0, currentStep: 0, totalSteps: steps.length, executionLog: [],
    stepsSnapshot: structuredClone(steps), nextRunAt: new Date(Date.now() + (steps.length ? sopDelayMs(steps[0].delayTime, steps[0].delayUnit) : 0)), ...patch };
  const matches = (where: any) => Object.entries(where).every(([key,value]) =>
    value && typeof value === 'object' && '_value' in value ? (value as any)._value.includes(row[key]) : row[key] === value);
  const repository = {
    findOne: vi.fn(async ({ where }: any) => matches(where) ? structuredClone(row) : null),
    find: vi.fn(async ({ where }: any) => matches(where) ? [structuredClone(row)] : []),
    update: vi.fn(async (where: any, value: any) => { if (!matches(where)) return { affected: 0 }; Object.assign(row,value); return { affected:1 }; }),
    create: vi.fn((x:any)=>x), save:vi.fn(async(x:any)=>x)
  };
  const store = {
    recover: vi.fn(async()=>{}),
    claim: vi.fn(async()=> {
      if(row.status!==0 || row.leaseToken || !row.nextRunAt || +row.nextRunAt>Date.now())return [];
      row.leaseToken='owned';return [structuredClone(row)];
    }),
    markAction:vi.fn(async(claim:any)=>{if(row.status!==0 || row.leaseToken!==claim.leaseToken)return false;row.actionStartedAt=new Date();return true;}),
    renew:vi.fn(async()=>true),
    release:vi.fn(async()=>{row.leaseToken=null;}),
    finish:vi.fn(async(claim:any,error?:Error)=>{
      if(row.leaseToken!==claim.leaseToken)return;
      row.executionLog.push({step:row.currentStep+1,stepName:steps[row.currentStep]?.stepName,status:error?'failed':'success',...(error?{error:error.message}:{})});
      if(error){row.errorMessage=error.message;if(row.status===0)row.status=3;row.nextRunAt=null;}
      else {row.currentStep++;if(row.currentStep===steps.length){if(row.status===0)row.status=1;row.nextRunAt=row.status===2?new Date():null;}
        else row.nextRunAt=new Date(Date.now()+sopDelayMs(steps[row.currentStep].delayTime,steps[row.currentStep].delayUnit));}
      row.leaseToken=null;row.actionStartedAt=null;
    }),
    resume:vi.fn(async(id:any,corp:any)=>{
      if(row.id!==id||row.corpId!==corp||row.status!==2)return {affected:0};
      row.status=row.currentStep===steps.length?1:0;return {affected:1};
    })
  };
  const http={post:vi.fn(async()=>({data:{success:true,data:{success:1,failed:0}}})),put:vi.fn(async()=>({data:{code:200,data:{id:10,followUserId:7}}}))};
  const action=Object.assign(new SopActionService(),{httpService:http,servicesConfig:{message:'http://message',customer:'http://customer'}});
  const scheduler=Object.assign(new SopScheduler(),{scheduleStore:store,actionService:action,schedulerConfig:{pollMs:1000,leaseMs:90000,maxConcurrent:10}});
  const service=Object.assign(new SopExecutionService(),{executionRepository:repository,scheduleStore:store,sopTemplateService:{getTemplate:vi.fn(async()=>({id:3,status:1,templateType:1,steps}))}});
  return {service:service as any,scheduler,action,steps,row:()=>row,repository,http,store};
}
