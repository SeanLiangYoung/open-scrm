import { test, expect } from '@playwright/test';
import * as crypto from 'crypto';
import { encryptWeworkMessage } from '../../services/integration-service/src/util/wework-msg-crypt.util';

const GATEWAY = process.env.GATEWAY_URL || 'http://127.0.0.1:17000';

/** 与 `code/scripts/init-db.pg.sql` 中 wework_config 种子及单测向量一致 */
const S2 = {
  token: 'scrm_s2_callback_token',
  encodingAesKey: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
  corpId: 'wx1234567890abcdef',
};

function buildMsgSignature(token: string, timestamp: string, nonce: string, cipher: string): string {
  return crypto.createHash('sha1').update([token, timestamp, nonce, cipher].sort().join('')).digest('hex');
}

test.describe('Sprint 2 — 集成服务经网关探测', () => {
  test('GET /api/v1/integration/health', async ({ request }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const res = await request.get(`${GATEWAY}/api/v1/integration/health`);
    if (!res.ok()) {
      console.error('integration health failed:', res.status(), await res.text());
    }
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({
      status: 'ok',
      service: 'integration-service',
      database: 'connected',
      redis: 'connected',
    });
  });

  test('GET /api/v1/integration/wework/callback — URL 验证（验签 + 解密 echostr）', async ({ request }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const plainEcho = 'sprint2_url_verify_plain';
    const echostr = encryptWeworkMessage(plainEcho, S2.encodingAesKey, S2.corpId);
    const timestamp = '1714281600';
    const nonce = 'nonce_s2_e2e';
    const msgSignature = buildMsgSignature(S2.token, timestamp, nonce, echostr);

    const url = new URL(`${GATEWAY}/api/v1/integration/wework/callback`);
    url.searchParams.set('msg_signature', msgSignature);
    url.searchParams.set('timestamp', timestamp);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('echostr', echostr);

    const res = await request.get(url.toString());
    expect(res.status(), await res.text()).toBe(200);
    expect(await res.text()).toBe(plainEcho);
  });

  test('POST /api/v1/integration/wework/callback — 推送 XML（验签 + 解密后返回 success）', async ({ request }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const innerXml = '<xml><MsgType><![CDATA[event]]></MsgType><Event><![CDATA[subscribe]]></Event></xml>';
    const encrypt = encryptWeworkMessage(innerXml, S2.encodingAesKey, S2.corpId);
    const timestamp = '1714281700';
    const nonce = 'nonce_s2_post';
    const msgSignature = buildMsgSignature(S2.token, timestamp, nonce, encrypt);

    const body = `<xml>
<Encrypt><![CDATA[${encrypt}]]></Encrypt>
</xml>`;

    const url = new URL(`${GATEWAY}/api/v1/integration/wework/callback`);
    url.searchParams.set('msg_signature', msgSignature);
    url.searchParams.set('timestamp', timestamp);
    url.searchParams.set('nonce', nonce);
    const res = await request.post(url.toString(), {
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      data: body,
    });
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.text()).trim()).toBe('success');
  });
});
