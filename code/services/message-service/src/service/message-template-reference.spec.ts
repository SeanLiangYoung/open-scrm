import { describe,it,expect,vi } from 'vitest';
import { getSchema } from '@midwayjs/validate';
import { MessageSendService } from './message-send.service';
import { MessageApiController } from '../controller/message-api.controller';
import { SendMessageDto,BatchSendMessageDto } from '../dto/send-message.dto';
function setup(){const sender=new MessageSendService();const getTemplate=vi.fn(async(id:number,corp:number)=>id===7&&corp===1?{id:7,corpId:1,status:0,messageType:1}:null);const repo={findOne:vi.fn(),create:vi.fn((x:object)=>({...x,id:42,retryCount:0})),save:vi.fn(async x=>x)};Object.assign(sender,{messageTemplateService:{getTemplate},messageLogRepository:repo,messageConfig:{batchSize:100}});return{sender,getTemplate,repo};}
const base={messageType:5,targetType:2,targetIds:[9],content:'explicit own content'};
describe('optional template reference ownership',()=>{
 for(const mode of ['single','batch'] as const){
  const run=(s:MessageSendService,dto:any)=>mode==='single'?s.sendMessage(1,dto):s.batchSendMessage(1,dto);
  it(`${mode} keeps own disabled cross-channel reference as metadata, explicit content unchanged`,async()=>{const t=setup();expect(await run(t.sender,{...base,templateId:7})).toMatchObject({success:1});expect(t.getTemplate).toHaveBeenCalledWith(7,1);expect(t.repo.create).toHaveBeenCalledWith(expect.objectContaining({corpId:1,templateId:7,content:'explicit own content',messageType:5}));});
  it.each([8,999])(`${mode} foreign/missing %s404 before log or idempotent reads`,async templateId=>{const t=setup();await expect(run(t.sender,{...base,templateId})).rejects.toMatchObject({status:404});expect(t.getTemplate).toHaveBeenCalledWith(templateId,1);expect(t.repo.create).not.toHaveBeenCalled();expect(t.repo.save).not.toHaveBeenCalled();expect(t.repo.findOne).not.toHaveBeenCalled();});
  it.each([0,Number.MAX_SAFE_INTEGER+1,'7',null,-1,1.5,2147483648,Number.MAX_SAFE_INTEGER])(`${mode} invalid ref %s400 before all repositories`,async templateId=>{const t=setup();await expect(run(t.sender,{...base,templateId})).rejects.toMatchObject({status:400});expect(t.getTemplate).not.toHaveBeenCalled();expect(t.repo.create).not.toHaveBeenCalled();});
  it(`${mode} no optional reference remains supported`,async()=>{const t=setup();expect(await run(t.sender,base)).toMatchObject({success:1});expect(t.getTemplate).not.toHaveBeenCalled();});
 }
 it('v1 foreign reference is rejected before marketing consent, Redis quota and old key replay',async()=>{const t=setup(),c=new MessageApiController();c.ctx={get:(k:string)=>({'x-corp-id':'1','x-user-id':'9'}[k]||''),state:{}} as any;c.messageSendService=t.sender;const consent=vi.fn().mockResolvedValue(true),policy=vi.fn().mockResolvedValue({allowed:true});c.consentRecordService={hasActiveMarketingConsentForCustomer:consent} as any;c.outboundPolicyStateService={tryConsumeMarketingSendSlot:policy} as any;t.repo.findOne.mockResolvedValue({id:42,corpId:1,messageType:5,sendStatus:1});await expect(c.send(undefined,{...base,targetType:1,templateId:8,idempotencyKey:'existing',consentPurpose:'marketing'})).rejects.toMatchObject({status:404});expect(consent).not.toHaveBeenCalled();expect(policy).not.toHaveBeenCalled();expect(t.repo.findOne).not.toHaveBeenCalled();expect(t.repo.save).not.toHaveBeenCalled();});
 for(const dto of [SendMessageDto,BatchSendMessageDto]){
  it.each(['7',0,-1,1.5,Number.MAX_SAFE_INTEGER+1,null,2147483648,Number.MAX_SAFE_INTEGER])(`${dto.name} actual schema rejects invalid templateId %s`,templateId=>{expect(getSchema(dto).validate({...base,templateId}).error).toBeTruthy()});
  it(`${dto.name} actual schema accepts absent and own numeric ref`,()=>{expect(getSchema(dto).validate(base).error).toBeUndefined();expect(getSchema(dto).validate({...base,templateId:7}).error).toBeUndefined()});
 }
});
