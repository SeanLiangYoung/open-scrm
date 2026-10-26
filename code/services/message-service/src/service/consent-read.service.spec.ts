import { describe, it, expect, vi } from 'vitest';
import { ConsentReadService } from './consent-read.service';
function setup(rows: any[] = [{ id:'9007199254740993',purpose:'marketing',policy_version:null,channel:null,locale:null,created_at:new Date('2026-10-26T00:00:00Z'),revoked_at:null,corp_id:'999',secret:'hidden' }]) {
  const manager = { query: vi.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.startsWith('SET')) return [];
    if (sql.includes('FROM customer ')) return [{ id:'7', observed_at:new Date('2026-10-26T00:01:00Z') }];
    if (sql.includes('COUNT(*)')) return [{ total:'3',active_count:'2',revoked_count:'1' }];
    return rows;
  }) };
  const transaction = vi.fn(async (_isolation: string, work: any) => work(manager));
  const s = new ConsentReadService();
  s.consentRepository = {manager:{transaction},query:vi.fn(()=>{throw Error('global repository forbidden')})} as any;
  return {s,manager,transaction};
}
describe('consent read model transaction and snapshot contract',()=>{
  it('reads tenant customer/count/page through one readonly repeatable manager and whitelists exact evidence',async()=>{
    const {s,manager,transaction}=setup(); const r=await s.readCustomerConsent(3,7,{page:2,pageSize:20});
    expect(transaction).toHaveBeenCalledWith('REPEATABLE READ',expect.any(Function));
    expect(manager.query.mock.calls[0][0]).toBe('SET TRANSACTION READ ONLY');
    expect(r).toEqual({customerId:'7',purpose:'marketing',observedAt:'2026-10-26T00:01:00.000Z',hasActiveMarketingConsent:true,activeCount:2,revokedCount:1,total:3,page:2,pageSize:20,list:[{id:'9007199254740993',purpose:'marketing',policyVersion:null,channel:null,locale:null,createdAt:'2026-10-26T00:00:00.000Z',revokedAt:null}]});
    expect(manager.query.mock.calls[1][1]).toEqual([7,3]);
    expect(manager.query.mock.calls[2][1]).toEqual([3,7]);
    expect(manager.query.mock.calls[3][1]).toEqual([3,7,20,20]);
    expect(manager.query.mock.calls[3][0]).toMatch(/ORDER BY created_at DESC, consent_record.id DESC/);
  });
  it('empty and out of range page retain actual snapshot totals',async()=>{
    const {s}=setup([]); const r=await s.readCustomerConsent(3,7,{page:99,pageSize:20}); expect(r.list).toEqual([]);expect(r.total).toBe(3);
  });
  it('zero evidence is distinct from read error',async()=>{
    const {s,manager}=setup([]);manager.query.mockImplementation(async(sql:string)=>sql.startsWith('SET')?[]:sql.includes('FROM customer ')?[{id:'7',observed_at:new Date()}]:sql.includes('COUNT(*)')?[{total:'0',active_count:'0',revoked_count:'0'}]:[]);
    expect(await s.readCustomerConsent(3,7,{page:1,pageSize:20})).toMatchObject({total:0,activeCount:0,revokedCount:0,hasActiveMarketingConsent:false,list:[]});
  });
  it('all revoked never claims active',async()=>{
    const {s,manager}=setup([]);manager.query.mockImplementation(async(sql:string)=>sql.startsWith('SET')?[]:sql.includes('FROM customer ')?[{id:'7',observed_at:new Date()}]:sql.includes('COUNT(*)')?[{total:'3',active_count:'0',revoked_count:'3'}]:[]);
    expect(await s.readCustomerConsent(3,7,{page:1,pageSize:20})).toMatchObject({hasActiveMarketingConsent:false,revokedCount:3});
  });
  it('foreign/missing customer is404 before evidence reads',async()=>{
    const {s,manager}=setup();manager.query.mockResolvedValue([]);
    await expect(s.readCustomerConsent(3,7,{page:1,pageSize:20})).rejects.toMatchObject({status:404});expect(manager.query).toHaveBeenCalledTimes(2);
  });
  it.each([[0,7,1,20],['3',7,1,20],[3,Number.MAX_SAFE_INTEGER+1,1,20],[3,7,0,20],[3,7,100001,20],[3,7,1,101],[3,7,'1',20]])('rejects direct invalid numbers %j before transaction',async(corp,id,page,size)=>{
    const {s,transaction}=setup();await expect(s.readCustomerConsent(corp as any,id as number,{page:page as number,pageSize:size as number})).rejects.toThrow();expect(transaction).not.toHaveBeenCalled();
  });
  it('rejects unsafe count without rounding and propagates DB failure',async()=>{
    const {s,manager}=setup();manager.query.mockImplementation(async(sql:string)=>sql.startsWith('SET')?[]:sql.includes('FROM customer ')?[{id:'7',observed_at:new Date()}]:[{total:'9007199254740993',active_count:'9007199254740993',revoked_count:'0'}]);
    await expect(s.readCustomerConsent(3,7,{page:1,pageSize:20})).rejects.toThrow(/count/i);
  });
  it('does not swallow query errors or convert them to zero evidence',async()=>{
    const {s,manager}=setup();manager.query.mockRejectedValue(Error('DB offline'));await expect(s.readCustomerConsent(3,7,{page:1,pageSize:20})).rejects.toThrow('DB offline');
  });
});
