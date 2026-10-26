import { test, expect, type Page } from '@playwright/test';
// API responses below are mocked; actual persistence is covered by separate runtime harness.
async function setup(page: Page, mode: 'normal'|'empty'|'error' = 'normal') {
 const requests: {path:string;method:string;url:string}[]=[];
 await page.addInitScript(()=>{localStorage.setItem('token','observed-dashboard-mock');localStorage.setItem('user',JSON.stringify({id:'7',username:'operator',corpId:'2'}));});
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());requests.push({path:url.pathname,method:route.request().method(),url:url.href});
  let data:unknown={list:[],total:0};
  if(url.pathname.endsWith('/observed-daily')) {
   if(mode==='error'){await route.fulfill({status:503,json:{message:'趋势服务不可用'}});return;}
   const start=url.searchParams.get('startDate')!,end=url.searchParams.get('endDate')!;const count=(Date.parse(end)-Date.parse(start))/86400000+1;
   data={startDate:start,endDate:end,dateBasis:'stored_daily_stat_date',eventDayTimezone:null,points:Array.from({length:count},(_,i)=>({date:new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10),observed:mode!=='empty'&&i>0,snapshotObservedAt:i===2?'2026-10-26T03:00:00Z':null,events:{newCustomerRecords:mode==='empty'||i===0?null:i===1?0:2,messageLogRecords:mode==='empty'||i===0?null:i===1?0:3,sopExecutionRecords:mode==='empty'||i===0?null:i===1?0:1},inventory:{totalCustomers:mode==='empty'||i===0?null:i===1?0:8,normalCustomers:mode==='empty'||i===0?null:i===1?0:7,deletedCustomers:mode==='empty'||i===0?null:i===1?0:1}}))};
  } else if(url.pathname.endsWith('/overview'))data={snapshotAvailable:false,total:0,active:0};
  await route.fulfill({json:{success:true,data}});
 });return requests;
}
const region=(page:Page)=>page.getByTestId('observed-trends');
test('mount performs only reads and requests bounded complete dates',async({page})=>{const calls=await setup(page);await page.goto('/');await expect(region(page)).toBeVisible();await expect(region(page).getByRole('row')).toHaveCount(8);expect(calls.every(c=>c.method==='GET')).toBe(true);expect(calls.some(c=>c.path.includes('aggregate-daily'))).toBe(false);const u=new URL(calls.find(c=>c.path.endsWith('observed-daily'))!.url);expect(u.searchParams.get('startDate')).toMatch(/^\d{4}-\d{2}-\d{2}$/);});
test('missing observation differs from an observed zero in accessible rows',async({page})=>{await setup(page);await page.goto('/');const rows=region(page).getByRole('row');await expect(rows.nth(1)).toContainText('未观测');await expect(rows.nth(2)).toContainText('已存日表');await expect(rows.nth(2).getByRole('cell').nth(2)).toHaveText('0');});
test('legacy observed row without time remains observed',async({page})=>{await setup(page);await page.goto('/');const row=region(page).getByRole('row').nth(2);await expect(row).toContainText('采集时间未记录');await expect(row).toContainText('已存日表');});
test('actual observation time and inventory caveats visible',async({page})=>{await setup(page);await page.goto('/');await expect(region(page)).toContainText('库存为采集时快照，不是历史日末状态');await expect(region(page)).toContainText('事件边界时区未记录');await expect(region(page).getByRole('row').nth(3)).not.toContainText('采集时间未记录');});
test('message log and SOP cohort labels do not promise delivery',async({page})=>{await setup(page);await page.goto('/');await expect(region(page)).toContainText('消息日志创建数');await expect(region(page)).toContainText('SOP执行创建数');await expect(region(page)).toContainText('含模拟/历史结果，不代表第三方送达');await expect(page.getByText('客户来源分布（最近最多100位客户样本）')).toBeVisible();});
test('controlled range selects14 calendar days',async({page})=>{const calls=await setup(page);await page.goto('/');await region(page).locator('.el-select').click();await page.getByRole('option',{name:'近14日',exact:true}).click();await expect(region(page).getByRole('row')).toHaveCount(15);const u=new URL(calls.filter(c=>c.path.endsWith('observed-daily')).at(-1)!.url);expect((Date.parse(u.searchParams.get('endDate')!)-Date.parse(u.searchParams.get('startDate')!))/86400000).toBe(13);});
test('all missing days show no saved observations, not a zero trend',async({page})=>{await setup(page,'empty');await page.goto('/');await expect(region(page)).toContainText('所选区间无已存日表');await expect(region(page).getByRole('row').nth(1)).toContainText('未观测');});
test('failed read is an error not an empty success',async({page})=>{await setup(page,'error');await page.goto('/');await expect(region(page)).toContainText('趋势服务不可用');await expect(region(page).getByText('所选区间无已存日表')).toHaveCount(0);});
test('older range response cannot overwrite the newer selected window',async({page})=>{
 await setup(page);let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let oldFinished!:()=>void;const oldDone=new Promise<void>(resolve=>{oldFinished=resolve;});
 await page.route('**/api/v1/analytics/observed-daily?**',async route=>{
  const u=new URL(route.request().url()),start=u.searchParams.get('startDate')!,end=u.searchParams.get('endDate')!;
  const count=(Date.parse(end)-Date.parse(start))/86400000+1;if(count===7)await gate;
  await route.fulfill({json:{success:true,data:{startDate:start,endDate:end,dateBasis:'stored_daily_stat_date',eventDayTimezone:null,points:Array.from({length:count},(_,i)=>({date:new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10),observed:false,snapshotObservedAt:null,events:{newCustomerRecords:null,messageLogRecords:null,sopExecutionRecords:null},inventory:{totalCustomers:null,normalCustomers:null,deletedCustomers:null}}))}}});if(count===7)oldFinished();
 });
 await page.goto('/');await region(page).locator('.el-select').click();await page.getByRole('option',{name:'近14日',exact:true}).click();await expect(region(page).getByRole('row')).toHaveCount(15);release();await oldDone;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect(region(page).getByRole('row')).toHaveCount(15);
});
