import { test, expect, type APIRequestContext } from '@playwright/test';
// This suite is only run by the disposable harness; every send explicitly uses Mock type 5.
test.beforeEach(() => {
  test.skip(process.env.OPERATION_HTTP_DISPOSABLE !== '1', 'Requires disposable operation HTTP harness');
});
async function login(request: APIRequestContext) {
  const result = await request.post('/api/v1/auth/login', { data: { username: 'admin', password: 'Admin@123' } });
  expect(result.ok(), await result.text()).toBeTruthy();
  const body = await result.json();
  expect(Number(body.user.corpId)).toBe(1);
  return { Authorization: `Bearer ${body.accessToken}` };
}

test('authenticated mass task creates, executes Mock sends and persists query results', async ({ request }) => {
  expect((await request.get('/api/mass-task/list')).status()).toBe(401);
  const headers = await login(request);
  const create = await request.post('/api/mass-task', { headers, data: {
    taskName: 'overnight-operation-mock', taskType: 1, targetType: 1,
    targetIds: [9001, 9003], messageType: 5, messageContent: 'HTTP mass task MOCK only',
  } });
  expect(create.ok(), await create.text()).toBeTruthy();
  const task = (await create.json()).data;
  const id = Number(task.id);
  expect(task).toMatchObject({ status: 0, messageType: 5, targetCount: 2, targetIds: [9001, 9003] });
  const executed = await request.post('/api/mass-task/execute', { headers, data: { taskId: id } });
  expect(executed.ok(), await executed.text()).toBeTruthy();
  expect((await executed.json()).data).toEqual({ success: 2, failed: 0 });
  const query = await request.get('/api/mass-task/list', { headers, params: { taskName: 'overnight-operation-mock' } });
  expect(query.ok(), await query.text()).toBeTruthy();
  const rows = (await query.json()).data.list;
  expect(rows).toHaveLength(1);
  expect(Number(rows[0].id)).toBe(id);
  expect(rows[0]).toMatchObject({ status: 2, successCount: 2, failCount: 0 });
  expect(Number(rows[0].createUserId)).toBe(Number(task.createUserId));
});

test('SOP trigger executes one Mock action and saves terminal progress', async ({ request }) => {
  const headers = await login(request);
  const create = await request.post('/api/sop/template', { headers, data: {
    templateName: 'overnight-immediate-mock', templateType: 1, triggerType: 4,
    steps: [{ stepOrder: 1, stepName: 'Mock送信', stepType: 1, delayTime: 0, delayUnit: 'minute', actionContent: { messageType: 5, content: 'HTTP SOP MOCK only' } }],
  } });
  expect(create.ok(), await create.text()).toBeTruthy();
  const templateId = Number((await create.json()).data.id);
  await test.step('SOP path IDs reject malformed writes without changing the original template', async () => {
    const baseline = await request.get(`/api/sop/template/${templateId}`, { headers });
    expect(baseline.status()).toBe(200);
    const snapshot = (await baseline.json()).data;
    for (const invalidId of [`${templateId}junk`, `${templateId}.5`, '9007199254740993']) {
      const update = await request.put(`/api/sop/template/${invalidId}`, {
        headers, data: { templateName: 'must never overwrite original template' }
      });
      expect(update.status(), await update.text()).toBe(400);
      const afterUpdate = await request.get(`/api/sop/template/${templateId}`, { headers });
      expect(afterUpdate.status()).toBe(200);
      expect((await afterUpdate.json()).data).toEqual(snapshot);
      const remove = await request.delete(`/api/sop/template/${invalidId}`, { headers });
      expect(remove.status(), await remove.text()).toBe(400);
      const afterDelete = await request.get(`/api/sop/template/${templateId}`, { headers });
      expect(afterDelete.status()).toBe(200);
      expect((await afterDelete.json()).data).toEqual(snapshot);
      expect((await request.get(`/api/sop/template/${invalidId}`, { headers })).status()).toBe(400);
      expect((await request.get(`/api/sop/steps/${invalidId}`, { headers })).status()).toBe(400);
    }
    const validUpdate = await request.put(`/api/sop/template/${templateId}`, {
      headers, data: { templateName: 'overnight-immediate-mock' }
    });
    expect(validUpdate.status(), await validUpdate.text()).toBe(200);
    const validSteps = await request.get(`/api/sop/steps/${templateId}`, { headers });
    expect(validSteps.status(), await validSteps.text()).toBe(200);
    expect((await validSteps.json()).data).toHaveLength(1);
    // Deletion-only control: supplied steps must be nonempty under M23. Never trigger this template.
    const disposable = await request.post('/api/sop/template', { headers, data: {
      templateName: 'overnight-path-delete-control', templateType: 1, triggerType: 4,
      steps: [{ stepOrder: 1, stepName: '删除对照夹具', stepType: 1, delayTime: 0, delayUnit: 'minute',
        actionContent: { messageType: 5, content: 'Deletion control fixture - never triggered' } }]
    } });
    expect(disposable.status(), await disposable.text()).toBe(200);
    const deleteId = Number((await disposable.json()).data.id);
    const validDelete = await request.delete(`/api/sop/template/${deleteId}`, { headers });
    expect(validDelete.status(), await validDelete.text()).toBe(200);
  });
  const trigger = await request.post('/api/sop/execute', { headers, data: { templateId, targetType: 1, targetIds: [9001] } });
  expect(trigger.ok(), await trigger.text()).toBeTruthy();
  expect((await trigger.json()).data.count).toBe(1);
  await expect.poll(async () => {
    const result = await request.get('/api/sop/executions', { headers, params: { templateId } });
    expect(result.ok(), await result.text()).toBeTruthy();
    return (await result.json()).data.list[0]?.status;
  }).toBe(1);
  const query = await request.get('/api/sop/executions', { headers, params: { templateId } });
  const row = (await query.json()).data.list[0];
  expect(row).toMatchObject({ status: 1, currentStep: 1, totalSteps: 1 });
  expect(row.executionLog).toHaveLength(1);
  expect(row.executionLog[0]).toMatchObject({ step: 1, status: 'success' });
});

test('delayed SOP pause resume cancel persists controls without sending', async ({ request }) => {
  const headers = await login(request);
  const create = await request.post('/api/sop/template', { headers, data: {
    templateName: 'overnight-control-mock', templateType: 1, triggerType: 4,
    steps: [{ stepOrder: 1, stepName: 'Delayed Mock', stepType: 1, delayTime: 1, delayUnit: 'minute', actionContent: { messageType: 5, content: 'Must never dispatch' } }],
  } });
  expect(create.ok(), await create.text()).toBeTruthy();
  const templateId = Number((await create.json()).data.id);
  const trigger = await request.post('/api/sop/execute', { headers, data: { templateId, targetType: 1, targetIds: [9003] } });
  expect(trigger.ok(), await trigger.text()).toBeTruthy();
  const executionId = Number((await trigger.json()).data.executions[0].id);
  for (const [action, status] of [['pause', 2], ['resume', 0], ['cancel', 3]] as const) {
    const control = await request.post('/api/sop/execution/control', { headers, data: { executionIds: executionId, action } });
    expect(control.ok(), await control.text()).toBeTruthy();
    expect((await control.json()).data.count).toBe(1);
    const query = await request.get('/api/sop/executions', { headers, params: { templateId } });
    expect((await query.json()).data.list[0]).toMatchObject({ status, currentStep: 0 });
  }
});

test('group SOP maps send and material actions to message group target type three', async ({ request }) => {
  const headers = await login(request);
  const create = await request.post('/api/sop/template', { headers, data: {
    templateName: 'overnight-group-mock', templateType: 2, triggerType: 4,
    steps: [1, 3].map((stepType, index) => ({ stepOrder: index + 1, stepName: `Group Mock ${stepType}`, stepType,
      delayTime: 0, delayUnit: 'minute', actionContent: { messageType: 5, content: `Group action ${stepType} MOCK only` } })),
  } });
  expect(create.ok(), await create.text()).toBeTruthy();
  const templateId = Number((await create.json()).data.id);
  const trigger = await request.post('/api/sop/execute', { headers, data: { templateId, targetType: 2, targetIds: [9004] } });
  expect(trigger.ok(), await trigger.text()).toBeTruthy();
  await expect.poll(async () => {
    const query = await request.get('/api/sop/executions', { headers, params: { templateId } });
    expect(query.ok(), await query.text()).toBeTruthy();
    return (await query.json()).data.list[0]?.status;
  }).toBe(1);
  const query = await request.get('/api/sop/executions', { headers, params: { templateId } });
  const row = (await query.json()).data.list[0];
  expect(row).toMatchObject({ targetType: 2, currentStep: 2, totalSteps: 2, status: 1 });
  expect(Number(row.groupId)).toBe(9004);
  expect(row.executionLog).toHaveLength(2);
});

test('HTTP200 downstream failed count terminates SOP without completed progress', async ({ request }) => {
  const headers = await login(request);
  const create = await request.post('/api/sop/template', { headers, data: {
    templateName: 'overnight-failed-mock', templateType: 1, triggerType: 4,
    steps: [{ stepOrder: 1, stepName: 'Injected Mock failure', stepType: 1, delayTime: 0, delayUnit: 'minute',
      actionContent: { messageType: 5, content: 'HTTP SOP MOCK reported failure' } }],
  } });
  expect(create.ok(), await create.text()).toBeTruthy();
  const templateId = Number((await create.json()).data.id);
  const trigger = await request.post('/api/sop/execute', { headers, data: { templateId, targetType: 1, targetIds: [9001] } });
  expect(trigger.ok(), await trigger.text()).toBeTruthy();
  await expect.poll(async () => {
    const query = await request.get('/api/sop/executions', { headers, params: { templateId } });
    expect(query.ok(), await query.text()).toBeTruthy();
    return (await query.json()).data.list[0]?.status;
  }).toBe(3);
  const query = await request.get('/api/sop/executions', { headers, params: { templateId } });
  const row = (await query.json()).data.list[0];
  expect(row).toMatchObject({ currentStep: 0, totalSteps: 1, status: 3 });
  expect(row.executionLog).toHaveLength(1);
  expect(row.executionLog[0]).toMatchObject({ step: 1, status: 'failed' });
  expect(row.errorMessage).toBeTruthy();
});
