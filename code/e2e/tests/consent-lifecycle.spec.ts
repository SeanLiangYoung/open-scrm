import { test, expect } from '@playwright/test';

const gateway = process.env.GATEWAY_URL || 'http://127.0.0.1:17000';
const customerId = Number(process.env.CONSENT_E2E_CUSTOMER_ID);

// This suite writes consent evidence. Explicitly opt into a disposable database/customer.
test('consent grant → mock marketing send → revoke → marketing blocked', async ({ request }) => {
  test.skip(process.env.CONSENT_E2E_DISPOSABLE !== '1' || !Number.isSafeInteger(customerId) || customerId < 1,
    'Requires CONSENT_E2E_DISPOSABLE=1 and disposable CONSENT_E2E_CUSTOMER_ID');
  const login = await request.post(`${gateway}/api/v1/auth/login`, {
    data: { username: process.env.E2E_ADMIN_USERNAME || 'admin', password: process.env.E2E_ADMIN_PASSWORD || 'Admin@123' },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  const token = (await login.json()).accessToken;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}` };
  const grant = { customerId, purpose: 'marketing', policyVersion: 'e2e-consent-v1', channel: 'web', locale: 'th-TH' };
  const subject = { customerId, purpose: 'marketing' };
  const endpoint = `${gateway}/api/v1/messages/consents`;
  const unauthorized = await request.post(`${endpoint}/grant`, { data: grant });
  expect(unauthorized.status()).toBe(401);
  for (const data of [{ ...grant, corpId: 999 }, { ...grant, userId: 999 }, { ...grant, policyVersion: '' }]) {
    const invalid = await request.post(`${endpoint}/grant`, { headers, data });
    expect(invalid.status(), await invalid.text()).toBe(400);
  }
  const invalidRevoke = await request.post(`${endpoint}/revoke`, { headers, data: { ...subject, corpId: 999 } });
  expect(invalidRevoke.status(), await invalidRevoke.text()).toBe(400);
  const missing = await request.post(`${endpoint}/grant`, { headers, data: { ...grant, customerId: Number.MAX_SAFE_INTEGER } });
  expect(missing.status(), await missing.text()).toBe(404);
  // Establish known state without modifying any seeded consent customer.
  const reset = await request.post(`${endpoint}/revoke`, { headers, data: subject });
  expect(reset.ok(), await reset.text()).toBeTruthy();
  try {
    for (let i = 0; i < 2; i++) {
      const result = await request.post(`${endpoint}/grant`, { headers, data: { ...grant, policyVersion: `e2e-consent-v${i + 1}` } });
      expect(result.ok(), await result.text()).toBeTruthy();
      expect((await result.json()).data).toMatchObject({ subjectType: 'customer', purpose: 'marketing', revokedAt: null });
    }
    const send = () => request.post(`${gateway}/api/v1/messages/send`, {
      headers,
      data: { messageType: 5, targetType: 1, targetIds: [customerId], content: 'Consent lifecycle MOCK only', consentPurpose: 'marketing', regionPackId: 'test-e2e-policy' },
    });
    const allowed = await send();
    expect(allowed.ok(), await allowed.text()).toBeTruthy();
    expect((await allowed.json()).data.success).toBe(1);
    const revoked = await request.post(`${endpoint}/revoke`, { headers, data: subject });
    expect(revoked.ok(), await revoked.text()).toBeTruthy();
    expect((await revoked.json()).data.revokedCount).toBe(2);
    const blocked = await send();
    expect(blocked.status(), await blocked.text()).toBe(403);
    const repeated = await request.post(`${endpoint}/revoke`, { headers, data: subject });
    expect(repeated.ok(), await repeated.text()).toBeTruthy();
    expect((await repeated.json()).data.revokedCount).toBe(0);
  } finally {
    const cleanup = await request.post(`${endpoint}/revoke`, { headers, data: subject });
    expect(cleanup.ok(), await cleanup.text()).toBeTruthy();
  }
});

test('two authenticated companies cannot grant/revoke foreign consent or spoof gateway identity', async ({ request }) => {
  const ownCustomer = Number(process.env.CONSENT_E2E_ISOLATION_CUSTOMER_ID);
  const otherCustomer = Number(process.env.CONSENT_E2E_OTHER_CUSTOMER_ID);
  const otherUsername = process.env.CONSENT_E2E_OTHER_USERNAME;
  const otherPassword = process.env.CONSENT_E2E_OTHER_PASSWORD;
  test.skip(process.env.CONSENT_E2E_DISPOSABLE !== '1' || !otherUsername || !otherPassword ||
    ![ownCustomer, otherCustomer].every(id => Number.isSafeInteger(id) && id > 0),
  'Requires disposable two-company consent fixtures and both real login credentials');
  async function login(username: string, password: string, corpId: number) {
    const result = await request.post(`${gateway}/api/v1/auth/login`, { data: { username, password } });
    expect(result.ok(), await result.text()).toBeTruthy();
    const body = await result.json();
    expect(Number(body.user.corpId)).toBe(corpId);
    expect(body.accessToken).toBeTruthy();
    return { Authorization: `Bearer ${body.accessToken}` };
  }
  const a = await login(process.env.E2E_ADMIN_USERNAME || 'admin', process.env.E2E_ADMIN_PASSWORD || 'Admin@123', 1);
  const b = await login(otherUsername!, otherPassword!, 2);
  const endpoint = `${gateway}/api/v1/messages/consents`;
  const grant = (id: number) => ({ customerId: id, purpose: 'marketing', policyVersion: 'e2e-isolation-v1', channel: 'web', locale: 'th-TH' });
  const subject = (id: number) => ({ customerId: id, purpose: 'marketing' });
  const spoofA = { ...a, 'x-corp-id': '2', 'x-user-id': '9002' };
  const spoofB = { ...b, 'x-corp-id': '1', 'x-user-id': '1' };
  const anonymous = await request.post(`${endpoint}/grant`, { headers: { 'x-corp-id': '2', 'x-user-id': '9002' }, data: grant(otherCustomer) });
  expect(anonymous.status()).toBe(401);
  // Use opposite-company headers even for own writes: only the JWT may choose the tenant.
  try {
    for (const [headers, id, corpId] of [[spoofA, ownCustomer, 1], [spoofB, otherCustomer, 2]] as const) {
      const result = await request.post(`${endpoint}/grant`, { headers, data: grant(id) });
      expect(result.ok(), await result.text()).toBeTruthy();
      const data = (await result.json()).data;
      expect(Number(data.corpId)).toBe(corpId);
      expect(Number(data.subjectId)).toBe(id);
    }
    for (const [headers, foreignCustomer] of [[spoofA, otherCustomer], [spoofB, ownCustomer]] as const) {
      const forbiddenGrant = await request.post(`${endpoint}/grant`, { headers, data: grant(foreignCustomer) });
      expect(forbiddenGrant.status(), await forbiddenGrant.text()).toBe(404);
      const forbiddenRevoke = await request.post(`${endpoint}/revoke`, { headers, data: subject(foreignCustomer) });
      expect(forbiddenRevoke.status(), await forbiddenRevoke.text()).toBe(404);
    }
    const send = (headers: Record<string, string>, id: number) => request.post(`${gateway}/api/v1/messages/send`, {
      headers,
      data: { messageType: 5, targetType: 1, targetIds: [id], content: 'Tenant isolation MOCK only', consentPurpose: 'marketing', regionPackId: 'test-e2e-policy' },
    });
    for (const [headers, foreignCustomer] of [[spoofA, otherCustomer], [spoofB, ownCustomer]] as const) {
      const blocked = await send(headers, foreignCustomer);
      expect(blocked.status(), await blocked.text()).toBe(403);
    }
    const ownSend = await send(spoofA, ownCustomer);
    expect(ownSend.ok(), await ownSend.text()).toBeTruthy();
    expect((await ownSend.json()).data.success).toBe(1);
    const ownRevoke = await request.post(`${endpoint}/revoke`, { headers: spoofA, data: subject(ownCustomer) });
    expect(ownRevoke.ok(), await ownRevoke.text()).toBeTruthy();
    expect((await ownRevoke.json()).data.revokedCount).toBe(1);
    // A's denied foreign revoke and successful own revoke must leave B's grant valid.
    const otherSend = await send(spoofB, otherCustomer);
    expect(otherSend.ok(), await otherSend.text()).toBeTruthy();
    expect((await otherSend.json()).data.success).toBe(1);
  } finally {
    for (const [headers, id] of [[a, ownCustomer], [b, otherCustomer]] as const) {
      const cleanup = await request.post(`${endpoint}/revoke`, { headers, data: subject(id) });
      expect(cleanup.ok(), await cleanup.text()).toBeTruthy();
    }
  }
});

test('PostgreSQL bigint tenants replay one Mock log per enterprise and reject conflicting keys', async ({ request }) => {
  const ownCustomer = Number(process.env.CONSENT_E2E_IDEMPOTENCY_CUSTOMER_ID);
  const otherCustomer = Number(process.env.CONSENT_E2E_OTHER_IDEMPOTENCY_CUSTOMER_ID);
  test.skip(process.env.CONSENT_E2E_DISPOSABLE !== '1' || ![ownCustomer, otherCustomer].every(id => Number.isSafeInteger(id) && id > 0) || !process.env.CONSENT_E2E_OTHER_USERNAME || !process.env.CONSENT_E2E_OTHER_PASSWORD,
    'Requires disposable two-enterprise idempotency fixtures');
  async function login(username: string, password: string) {
    const result = await request.post(`${gateway}/api/v1/auth/login`, { data: { username, password } });
    expect(result.ok(), await result.text()).toBeTruthy();
    return (await result.json()).accessToken as string;
  }
  const ownToken = await login(process.env.E2E_ADMIN_USERNAME || 'admin', process.env.E2E_ADMIN_PASSWORD || 'Admin@123');
  const otherToken = await login(process.env.CONSENT_E2E_OTHER_USERNAME!, process.env.CONSENT_E2E_OTHER_PASSWORD!);
  const key = `test-pg-bigint-replay-${Date.now()}`;
  const send = (token: string, id: number, content: string, bodyKey = key) => request.post(`${gateway}/api/v1/messages/send`, {
    headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key },
    data: { messageType: 5, targetType: 1, targetIds: [id], content, idempotencyKey: bodyKey },
  });
  const first = await send(ownToken, ownCustomer, 'original enterprise A Mock');
  expect(first.ok(), await first.text()).toBeTruthy();
  const firstId = (await first.json()).data.details[0].messageLogId;
  const replay = await send(ownToken, ownCustomer, 'changed content must replay original');
  expect(replay.ok(), await replay.text()).toBeTruthy();
  const replayBody = (await replay.json()).data;
  expect(replayBody).toMatchObject({ idempotentReplay: true, success: 1, failed: 0, total: 1, content: 'original enterprise A Mock' });
  expect(String(replayBody.messageLogId)).toBe(String(firstId));
  const other = await send(otherToken, otherCustomer, 'original enterprise B Mock');
  expect(other.ok(), await other.text()).toBeTruthy();
  const otherId = (await other.json()).data.details[0].messageLogId;
  expect(String(otherId)).not.toBe(String(firstId));
  const otherReplay = await send(otherToken, otherCustomer, 'changed enterprise B content');
  expect(otherReplay.ok(), await otherReplay.text()).toBeTruthy();
  const otherBody = (await otherReplay.json()).data;
  expect(otherBody).toMatchObject({ idempotentReplay: true, success: 1, failed: 0, content: 'original enterprise B Mock' });
  expect(String(otherBody.messageLogId)).toBe(String(otherId));
  const mismatch = await send(ownToken, ownCustomer, 'must not create a log', `${key}-conflict`);
  expect(mismatch.status(), await mismatch.text()).toBe(400);
});
