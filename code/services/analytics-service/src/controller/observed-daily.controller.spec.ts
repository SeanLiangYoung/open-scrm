import {expect,it,vi} from 'vitest';
import {ObservedDailyController} from './observed-daily.controller';
const window={startDate:'2026-01-01',endDate:'2026-01-02'};
function setup(headers:Record<string,string>={},user:unknown=undefined){const read=vi.fn().mockResolvedValue({points:[]});const controller=new ObservedDailyController();Object.assign(controller,{ctx:{headers,get:(key:string)=>headers[key]||'',state:{user},throw:(status:number,message:string)=>{throw Object.assign(new Error(message),{status});}},observedDailyService:{read}});return{controller,read};}
it.each([
 [{},undefined,'missing'],[{'x-corp-id':'25'},undefined,'missing user'],[{'x-user-id':'7'},undefined,'missing corp'],
 [{'x-corp-id':'25junk','x-user-id':'7'},undefined,'malformed corp'],[{'x-corp-id':'25','x-user-id':'7junk'},undefined,'malformed user'],
 [{'x-corp-id':'9007199254740993','x-user-id':'7'},undefined,'unsafe'],[{'x-corp-id':'025','x-user-id':'7'},undefined,'leadingzero'],
 [{},{corpId:25},'state missinguser'],[{},{corpId:25,userId:'7junk'},'state malformed'],
 [{'x-corp-id':'bad','x-user-id':'7'},{corpId:25,userId:7},'badheader no fallback'],
 [{'x-user-id':'bad'},{corpId:25,userId:7},'partialheader no fallback'],
 [{'x-corp-id':'','x-user-id':''},{corpId:25,userId:7},'present emptyheaders no fallback'],
] as const)('rejects identity %s (%s)',async(headers,user)=>{const t=setup(headers,user);await expect(t.controller.read(window)).rejects.toMatchObject({status:401});expect(t.read).not.toHaveBeenCalled();});
it('trusted complete state accepted only without identity headers',async()=>{const t=setup({}, {corpId:25,userId:7});await t.controller.read(window);expect(t.read).toHaveBeenCalledWith(25,window);});
it('complete canonical headers accepted',async()=>{const t=setup({'x-corp-id':'25','x-user-id':'7'});await t.controller.read(window);expect(t.read).toHaveBeenCalledWith(25,window);});
