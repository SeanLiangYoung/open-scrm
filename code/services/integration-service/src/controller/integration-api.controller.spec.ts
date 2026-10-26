import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { IntegrationApiController } from './integration-api.controller';
import { decryptWeworkMessage, verifyWeworkMsgSignature } from '../util/wework-msg-crypt.util';

const ciphertext =
  'Q3stYC6hdFzMh9T8HCvyDBi+USosE2Gv611az/Jxrha7Sqa470+R5XvbkAEPqL9WhPmzJzfMLenZEUWM5fUQWQ==';
const config = {
  corpId: 'wx1234567890abcdef',
  callbackToken: 'test-token',
  encodingAesKey: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG'
};
const timestamp = '1714281700';
const nonce = 'test-nonce';
const signature = createHash('sha1')
  .update([config.callbackToken, timestamp, nonce, ciphertext].sort().join(''))
  .digest('hex');

function setup(query: Record<string, unknown>) {
  const controller = new IntegrationApiController();
  const ctx: any = {
    query,
    request: { body: `<xml><Encrypt><![CDATA[${ciphertext}]]></Encrypt></xml>` },
    status: 200
  };
  const decryptMessage = vi.fn(decryptWeworkMessage);
  Object.assign(controller, {
    ctx,
    weworkApiService: {
      getConfig: vi.fn(async () => config),
      verifyCallbackMsgSignature: (
        sig: string,
        time: string,
        n: string,
        encrypted: string,
        token: string
      ) => verifyWeworkMsgSignature(token, time, n, encrypted, sig),
      decryptMessage
    }
  });
  return { controller, ctx, decryptMessage };
}

describe('WeCom POST callback request shape', () => {
  it('reads the signature from URL query and decrypts a protocol-compatible body', async () => {
    const t = setup({ msg_signature: signature, timestamp, nonce });
    await t.controller.weworkCallbackPost();
    expect(t.ctx.status).toBe(200);
    expect(t.ctx.body).toBe('success');
    expect(t.decryptMessage).toHaveBeenCalledTimes(1);
  });

  it('rejects an incorrect query signature before decryption', async () => {
    const t = setup({ msg_signature: 'incorrect', timestamp, nonce });
    await t.controller.weworkCallbackPost();
    expect(t.ctx.status).toBe(403);
    expect(t.decryptMessage).not.toHaveBeenCalled();
  });

  it.each([{}, { msg_signature: [signature], timestamp, nonce }])(
    'rejects missing or repeated query fields',
    async query => {
      const t = setup(query);
      await t.controller.weworkCallbackPost();
      expect(t.ctx.status).toBe(400);
      expect(t.decryptMessage).not.toHaveBeenCalled();
    }
  );
});
