import { test, expect, type Page } from '@playwright/test';
test.skip(process.env.CUSTOMER_CONSENT_DISPOSABLE !== '1','Requires isolated consent UI fixture');
async function login(page:Page,other=false) {
  await page.goto('/login'); await page.getByPlaceholder('用户名').fill(other?'consent_other':'admin');
  await page.getByPlaceholder('密码',{exact:true}).fill('Admin@123');
  await page.getByRole('button',{name:/登.*录/}).click(); await expect(page).not.toHaveURL(/\/login/);
}
async function evidence(page:Page,policy:string) {
  await page.getByPlaceholder('填写实际授权政策版本').fill(policy); await page.locator('.el-form-item').filter({ hasText: '证据渠道' }).locator('.el-select').click();
  await page.getByRole('option',{name:'Web',exact:true}).click(); await page.getByPlaceholder('例如 zh-CN').fill('zh-CN');
}
async function post(page:Page,path:string,data:unknown) {
  const token=await page.evaluate(()=>localStorage.getItem('token'));
  return page.request.post(path,{headers:{Authorization:`Bearer ${token}`},data});
}
test('A records actual evidence through UI then explicit Mock marketing passes',async({page},testInfo)=>{
  await login(page); await page.goto('/customers/9001'); await evidence(page,'ui-consent-a');
  await page.getByRole('button',{name:'登记授权证据',exact:true}).click(); await expect(page.getByTestId('consent-operation-result')).toContainText('本次登记');
  const result=await post(page,'/api/v1/messages/send',{messageType:5,targetType:1,targetIds:[9001],content:'isolated consent UI Mock',consentPurpose:'marketing',regionPackId:'test-e2e-policy'});
  expect(result.status(),await result.text()).toBe(200); expect((await result.json()).data.success).toBe(1);
  await page.screenshot({path:testInfo.outputPath('consent-grant-success.png'),fullPage:true,animations:'disabled'});
});
test('A revokes through UI and next Mock marketing is denied403',async({page})=>{
  await login(page); await page.goto('/customers/9001'); await page.getByRole('button',{name:'撤回营销授权',exact:true}).click();
  await expect(page.getByTestId('consent-operation-result')).toContainText('本次撤回 1 条');
  const result=await post(page,'/api/v1/messages/send',{messageType:5,targetType:1,targetIds:[9001],content:'blocked after UI revoke',consentPurpose:'marketing',regionPackId:'test-e2e-policy'}); expect(result.status()).toBe(403);
});
test('repeat UI revoke reports zero without a fake persisted status',async({page})=>{
  await login(page); await page.goto('/customers/9001'); await expect(page.getByTestId('consent-operation-result')).not.toBeVisible();
  await page.getByRole('button',{name:'撤回营销授权',exact:true}).click(); await expect(page.getByTestId('consent-operation-result')).toContainText('本次撤回 0 条');
});
test('B UI records own evidence while foreign A grant/revoke both404 despite forged headers',async({page})=>{
  await login(page,true); await page.goto('/customers/9002'); await evidence(page,'ui-consent-b');
  await page.getByRole('button',{name:'登记授权证据',exact:true}).click(); await expect(page.getByTestId('consent-operation-result')).toContainText('本次登记');
  const token=await page.evaluate(()=>localStorage.getItem('token'));
  for(const action of ['grant','revoke']) {
    const data=action==='grant'?{customerId:9001,purpose:'marketing',policyVersion:'foreign-forbidden',channel:'web',locale:'zh-CN'}:{customerId:9001,purpose:'marketing'};
    const result=await page.request.post(`/api/v1/messages/consents/${action}`,{headers:{Authorization:`Bearer ${token}`,'x-corp-id':'1','x-user-id':'1'},data}); expect(result.status()).toBe(404);
  }
});
