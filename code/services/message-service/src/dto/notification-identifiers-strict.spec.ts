import { describe,it,expect } from 'vitest';
import { getSchema } from '@midwayjs/validate';
import { CreateNotificationDto,MarkReadDto } from './notification.dto';
const invalid:unknown[]=['1','1e0','0x1',' 1','01',true,false,[true],['1e0'],['0x1'],[[]],[[1]],[],Array(101).fill(1),[0],[-1],[1.2],[Number.MAX_SAFE_INTEGER+1],0,-1,1.2,Number.MAX_SAFE_INTEGER+1,null,undefined];
for(const [name,dto,field,extra] of [
 ['CreateNotificationDto',CreateNotificationDto,'userIds',{notificationType:1,title:'actual evidence',content:'strict recipient test'}],
 ['MarkReadDto',MarkReadDto,'notificationIds',{}],
] as const){
 describe(`${name} strict bigint numeric identities`,()=>{
  it.each(invalid.map((value,index)=>({value,index})) )('rejects invalid shape $index without coercion',({value})=>{const result=getSchema(dto).validate({...extra,[field]:value});expect(result.error).toBeDefined();});
  it.each([1,Number.MAX_SAFE_INTEGER,[1],[1,Number.MAX_SAFE_INTEGER],Array(100).fill(1)].map((value,index)=>({value,index})))('accepts supported numeric shape $index including safe bigint range',({value})=>{const result=getSchema(dto).validate({...extra,[field]:value});expect(result.error).toBeUndefined();expect(result.value[field]).toEqual(value);});
 });
}
