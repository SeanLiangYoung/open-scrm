import { describe,it,expect,vi } from 'vitest';
import { ConsentReadController } from './consent-read.controller';
function fixture(headers:Record<string,string>={'x-corp-id':'3','x-user-id':'9'}){
 const c=new ConsentReadController();c.ctx={get:(k:string)=>headers[k]||'',state:{}} as any;
 c.consentReadService={readCustomerConsent:vi.fn().mockResolvedValue({total:0})} as any;return c;
}
describe('consent read HTTP contract',()=>{
 it('uses trusted tenant and strict defaults',async()=>{const c=fixture();expect(await c.read('7',{})).toEqual({success:true,data:{total:0}});expect(c.consentReadService.readCustomerConsent).toHaveBeenCalledWith(3,7,{page:1,pageSize:20});});
 it('supports valid bounded pagination and state identity',async()=>{const c=fixture({});c.ctx.state.user={corpId:3,userId:9};await c.read('7',{page:'100000',pageSize:'100'});expect(c.consentReadService.readCustomerConsent).toHaveBeenCalledWith(3,7,{page:100000,pageSize:100});});
 it.each([{}, {'x-corp-id':'3'}, {'x-corp-id':'3bad','x-user-id':'9'}, {'x-corp-id':'0','x-user-id':'9'}])('missing/invalid identity401 %j',async h=>{const c=fixture(h);await expect(c.read('7',{})).rejects.toMatchObject({status:401});expect(c.consentReadService.readCustomerConsent).not.toHaveBeenCalled();});
 it.each(['0','-1','1.2','1e2',' 7','07','9007199254740993','7tail'])('invalid path400 %s',async id=>{const c=fixture();await expect(c.read(id,{})).rejects.toMatchObject({status:400});expect(c.consentReadService.readCustomerConsent).not.toHaveBeenCalled();});
 it.each([{page:''},{page:['1','2']},{page:'01'},{page:'1e2'},{page:'100001'},{pageSize:'101'},{pageSize:'0'},{corpId:'9'},{purpose:'marketing'},{userId:'3'},null])('invalid strict query400 %j',async q=>{const c=fixture();await expect(c.read('7',q)).rejects.toMatchObject({status:400});expect(c.consentReadService.readCustomerConsent).not.toHaveBeenCalled();});
});
