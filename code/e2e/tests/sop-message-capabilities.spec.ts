import { test, expect, type Page } from '@playwright/test';
// UI contract tests only: every API response is mocked; no execution or messages.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('token', 'mock-sop-capabilities'); localStorage.setItem('user', JSON.stringify({ id: '7', username: 'operator', corpId: '2' })); });
  await page.route('**/api/**', route => route.fulfill({ json: { success: true, data: { list: [] } } }));
});
async function newStep(page: Page, stepType: number) {
  await page.goto('/sop/create');
  await page.getByPlaceholder('如：新客欢迎SOP').fill('显式模拟流程');
  await page.getByRole('button', { name: '添加步骤' }).click();
  const step = page.locator('.step-item');
  if (stepType === 3) {
    await step.locator('.el-select').first().click();
    await page.getByRole('option', { name: '推送素材', exact: true }).click();
    await step.getByPlaceholder('素材链接 URL').fill('https://example.invalid/material');
  } else await step.getByPlaceholder('消息文本内容').fill('模拟正文');
  return step;
}
async function legacy(page: Page, stepType: number, action: Record<string, unknown>) {
  await page.route('**/api/sop/template/3', route => route.fulfill({ json: { success: true, data: {
    id: 3, templateName: '旧版流程', templateType: 1, triggerType: 4,
    steps: [{ stepName: '旧步骤', stepType, actionContent: action, delayTime: 0, delayUnit: 'minute' }],
  } } }));
  await page.goto('/sop/3/edit');
  await page.getByPlaceholder('如：新客欢迎SOP').fill('只修改名称');
  return page.locator('.step-item');
}
async function save(page: Page, editing = false) {
  const request = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname === (editing ? '/api/sop/steps/batch' : '/api/sop/template'));
  await page.getByRole('button', { name: editing ? '保存修改' : '创建 SOP', exact: true }).click();
  return (await request).postDataJSON().steps[0].actionContent;
}

test('new message is visibly Mock and explicitly submits numeric messageType five', async ({ page }) => {
  const step = await newStep(page, 1);
  await expect(step.getByText('模拟消息，不会真实送达', { exact: true })).toBeVisible();
  expect(await save(page)).toEqual({ messageType: 5, content: '模拟正文' });
});
test('new material is visibly Mock and explicitly submits numeric messageType five', async ({ page }) => {
  const step = await newStep(page, 3);
  await expect(step.getByText('模拟消息，不会真实送达', { exact: true })).toBeVisible();
  expect(await save(page)).toEqual({ messageType: 5, url: 'https://example.invalid/material', content: '' });
});
for (const scenario of [
  { name: 'message', stepType: 1, action: { messageType: 3, content: '原短信正文', extra: { campaign: 'legacy' } } },
  { name: 'material', stepType: 3, action: { messageType: 4, url: 'https://example.invalid/old', content: '原素材说明', extra: { campaign: 'legacy' } } },
]) test(`legacy explicit ${scenario.name} channel remains unchanged and warns not connected`, async ({ page }) => {
  const step = await legacy(page, scenario.stepType, scenario.action);
  await expect(step.getByText('此旧步骤的渠道尚未接通，保留原配置，不会真实送达', { exact: true })).toBeVisible();
  expect(await save(page, true)).toEqual(scenario.action);
});
for (const stepType of [1, 3]) test(`legacy omitted channel on step ${stepType} stays absent instead of silently becoming Mock`, async ({ page }) => {
  const action = stepType === 1 ? { content: '旧默认正文' } : { url: 'https://example.invalid/default', content: '旧默认素材' };
  const step = await legacy(page, stepType, action);
  await expect(step.getByText('此旧步骤的渠道尚未接通，保留原配置，不会真实送达', { exact: true })).toBeVisible();
  const saved = await save(page, true);
  expect(saved).toEqual(action);
  expect(saved).not.toHaveProperty('messageType');
});
test('existing explicit Mock stays Mock and preserves metadata', async ({ page }) => {
  const action = { messageType: 5, content: '已有模拟', extra: { campaign: 'explicit-mock' } };
  const step = await legacy(page, 1, action);
  await expect(step.getByText('模拟消息，不会真实送达', { exact: true })).toBeVisible();
  expect(await save(page, true)).toEqual(action);
});
test('changing a legacy message to material retains its explicit channel intent', async ({ page }) => {
  const step = await legacy(page, 1, { messageType: 3, content: '旧短信' });
  await step.locator('.el-select').first().click();
  await page.getByRole('option', { name: '推送素材', exact: true }).click();
  await step.getByPlaceholder('素材链接 URL').fill('https://example.invalid/changed');
  await expect(step.getByText('此旧步骤的渠道尚未接通，保留原配置，不会真实送达', { exact: true })).toBeVisible();
  expect(await save(page, true)).toEqual({ messageType: 3, url: 'https://example.invalid/changed', content: '' });
});
