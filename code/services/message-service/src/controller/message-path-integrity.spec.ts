import { describe,it,expect,vi } from 'vitest';
import { MessageController } from './message.controller';
import { MessageApiController } from './message-api.controller';
const entries=['template-get','template-update','template-delete','legacy-log','v1-log'] as const;
function setup(){const c=new MessageController(),v=new MessageApiController();const ctx={get:(k:string)=>({'x-corp-id':'1','x-user-id':'9'}[k]||''),state:{}};c.ctx=v.ctx=ctx as any;const getTemplate=vi.fn(),updateTemplate=vi.fn(),deleteTemplate=vi.fn(),getLog=vi.fn();c.messageTemplateService={getTemplate,updateTemplate,deleteTemplate} as any;c.messageLogService=v.messageLogService={getLog} as any;
 return {call:(kind:typeof entries[number],id:string)=>kind==='template-get'?c.getTemplate(id):kind==='template-update'?c.updateTemplate(id,{templateName:'new'}):kind==='template-delete'?c.deleteTemplate(id):kind==='legacy-log'?c.getLog(id):v.getLog(id),spies:[getTemplate,updateTemplate,deleteTemplate,getLog]};}
describe('legacy/v1 message path identity integrity',()=>{
 for(const kind of entries){
  it.each(['7tail','7.9','7e2',' 7','07','0','-1','9007199254740993'])(`${kind} rejects malformed %s before service call`,async id=>{const t=setup();await expect(t.call(kind,id)).rejects.toMatchObject({status:400});t.spies.forEach(s=>expect(s).not.toHaveBeenCalled());});
  it(`${kind} keeps valid tenant-scoped numeric path`,async()=>{const t=setup();await t.call(kind,'7');const invoked=t.spies.find(s=>s.mock.calls.length)!;expect(invoked.mock.calls[0][0]).toBe(7);expect(invoked.mock.calls[0][1]).toBe(1);});
 }
});

describe('template int4 range differs from bigint log safe range',()=>{
 for(const kind of ['template-get','template-update','template-delete'] as const) it.each(['2147483648','9007199254740991'])(`${kind} rejects int4 overflow %s`,async id=>{const t=setup();await expect(t.call(kind,id)).rejects.toMatchObject({status:400});t.spies.forEach(s=>expect(s).not.toHaveBeenCalled())});
 for(const kind of ['legacy-log','v1-log'] as const) it(`${kind} still accepts bigint MAX_SAFE`,async()=>{const t=setup();await t.call(kind,String(Number.MAX_SAFE_INTEGER));expect(t.spies[3]).toHaveBeenCalledWith(Number.MAX_SAFE_INTEGER,1)});
});
