import { describe, expect, it } from 'vitest';
import { parseObservedWindow, projectObservedDaily } from './observed-daily.util';
describe('observed daily calendar and measurement semantics', () => {
 it.each([
  [{},'missing'],[{startDate:'2026-02-30',endDate:'2026-03-01'},'impossible'],
  [{startDate:'2026-1-01',endDate:'2026-01-02'},'format'],[{startDate:'2026-03-02',endDate:'2026-03-01'},'reverse'],
  [{startDate:'2026-01-01',endDate:'2026-02-01'},'32days'],[{startDate:'2026-01-01',endDate:'2026-01-02',corpId:2},'spoof'],
  [{startDate:['2026-01-01'],endDate:'2026-01-02'},'array'],[{startDate:'2026-02-29',endDate:'2026-03-01'},'nonleap']
 ])('rejects %s (%s)',query=>expect(()=>parseObservedWindow(query)).toThrow());
 it('accepts31 inclusive days',()=>expect(parseObservedWindow({startDate:'2026-01-01',endDate:'2026-01-31'}).dates).toHaveLength(31));
 it('crosses year using UTC arithmetic',()=>expect(parseObservedWindow({startDate:'2025-12-31',endDate:'2026-01-02'}).dates).toEqual(['2025-12-31','2026-01-01','2026-01-02']));
 it('accepts leapday',()=>expect(parseObservedWindow({startDate:'2028-02-28',endDate:'2028-03-01'}).dates).toHaveLength(3));
 const window=()=>parseObservedWindow({startDate:'2025-12-31',endDate:'2026-01-02'});
 const row={date:'2026-01-01',newCustomerRecords:0,messageLogRecords:0,sopExecutionRecords:0,totalCustomers:8,normalCustomers:7,deletedCustomers:1,observedAt:null};
 it('missing points null',()=>expect(projectObservedDaily(window(),[row]).points[0]).toEqual({date:'2025-12-31',observed:false,snapshotObservedAt:null,events:{newCustomerRecords:null,messageLogRecords:null,sopExecutionRecords:null},inventory:{totalCustomers:null,normalCustomers:null,deletedCustomers:null}}));
 it('observedzero remains even when legacy time null',()=>expect(projectObservedDaily(window(),[row]).points[1]).toMatchObject({observed:true,snapshotObservedAt:null,events:{newCustomerRecords:0,messageLogRecords:0,sopExecutionRecords:0}}));
 it('inventory not summed/carriedforward',()=>{const r=projectObservedDaily(window(),[row,{...row,date:'2026-01-02',totalCustomers:9,observedAt:'2026-10-26T03:00:00Z'}]);expect(r.points.map(p=>p.inventory.totalCustomers)).toEqual([null,8,9]);expect(r.points[2].snapshotObservedAt).toBe('2026-10-26T03:00:00Z');});
 it('whitelists and unknown timezone',()=>{const r=projectObservedDaily(window(),[{...row,corpId:999,password:'secret'}]);expect(r.dateBasis).toBe('stored_daily_stat_date');expect(r.eventDayTimezone).toBeNull();expect(JSON.stringify(r)).not.toMatch(/password|corpId|activeCustomer/);});
});
