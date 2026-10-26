import { describe, it, expect, vi } from 'vitest';
import { getSchema } from '@midwayjs/validate';
import { MessageController } from './message.controller';
import { RetryMessageDto } from '../dto/message-log.dto';
function fixture(headers: Record<string, string> = {}, user?: any) {
  const c = new MessageController();
  c.ctx = { get: (key: string) => headers[key] || '', state: { user } } as any;
  const retryFailedMessages = vi.fn().mockResolvedValue({ total: 0, success: 0, failed: 0, details: [] });
  c.messageSendService = { retryFailedMessages } as any;
  return { c, retryFailedMessages };
}
describe('retry trusted identity and DTO', () => {
  it.each([{}, { 'x-corp-id': '1' }, { 'x-corp-id': '1oops', 'x-user-id': '9' }, { 'x-corp-id': '0', 'x-user-id': '9' }])('missing/invalid complete identity fails closed %j', async headers => {
    const { c, retryFailedMessages } = fixture(headers);
    await expect(c.retryMessage({ logIds: [1] })).rejects.toMatchObject({ status: 401 });
    expect(retryFailedMessages).not.toHaveBeenCalled();
  });
  it('accepts complete gateway identity and keeps envelope', async () => {
    const { c, retryFailedMessages } = fixture({ 'x-corp-id': '2', 'x-user-id': '9' });
    expect(await c.retryMessage({ logIds: [1] })).toMatchObject({ success: true, message: '重试完成' });
    expect(retryFailedMessages).toHaveBeenCalledWith(2, [1]);
  });
  it('accepts state identity when gateway header absent', async () => {
    const { c, retryFailedMessages } = fixture({}, { corpId: 3, userId: 9 });
    await c.retryMessage({ logIds: 1 }); expect(retryFailedMessages).toHaveBeenCalledWith(3, 1);
  });
  it.each([[], ['1'], [0], [1.5], Array(101).fill(1), '1'])('actual DTO rejects invalid IDs %j', value => {
    expect(getSchema(RetryMessageDto).validate({ logIds: value }).error).toBeTruthy();
  });
  it('actual DTO accepts scalar and array numeric IDs', () => {
    for (const logIds of [1, [1, 2]]) expect(getSchema(RetryMessageDto).validate({ logIds }).error).toBeUndefined();
  });
});
