import { Readable } from 'stream';
import { existsSync, ReadStream } from 'fs';
import { rm } from 'fs/promises';
import { dirname } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { ProxyMiddleware } from './proxy.middleware';

vi.mock('fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, rm: vi.fn(actual.rm) };
});

function setup(
  path = '/api/v1/assets/upload',
  chunks = [Buffer.from([0, 255, 13, 10])],
  length = ''
) {
  const middleware = new ProxyMiddleware();
  middleware.routes = [
    { path: '/api/v1/assets/*', target: 'http://asset', upstreamPrefix: '/api/asset' },
    { path: '/api/asset/*', target: 'http://asset' }
  ];
  const received: Buffer[] = [];
  let stream: Readable;
  const request = vi.fn(async (options: any) => {
    stream = options.data;
    if (options.data instanceof Readable) {
      for await (const chunk of options.data) received.push(Buffer.from(chunk));
    }
    return { status: 422, data: { message: 'invalid upload' }, headers: {} };
  });
  middleware.httpService = { request } as any;
  const headers = {
    'content-type': 'multipart/form-data; boundary=example',
    'content-length': length
  };
  const ctx: any = {
    path,
    method: 'POST',
    query: {},
    req: Readable.from(chunks),
    request: { body: {} },
    state: { user: { userId: 8, corpId: 7 } },
    get: (name: string) => headers[name] || '',
    set: vi.fn(),
    logger: { warn: vi.fn() }
  };
  return { middleware, ctx, request, received, getStream: () => stream };
}

describe('multipart asset proxy', () => {
  it.each(['/api/v1/assets/upload', '/api/asset/upload'])(
    'forwards raw binary for %s and preserves backend validation once',
    async path => {
      const fixture = setup(path);
      await fixture.middleware.resolve()(fixture.ctx, vi.fn());
      expect(Buffer.concat(fixture.received)).toEqual(Buffer.from([0, 255, 13, 10]));
      expect(fixture.request).toHaveBeenCalledTimes(1);
      expect(fixture.request.mock.calls[0][0]).toMatchObject({
        url: 'http://asset/api/asset/upload',
        maxBodyLength: 101 * 1024 * 1024,
        timeout: 120_000,
        headers: {
          'content-type': 'multipart/form-data; boundary=example',
          'x-user-id': '8',
          'x-corp-id': '7'
        }
      });
      expect(fixture.ctx.status).toBe(422);
      expect(fixture.getStream().destroyed).toBe(true);
      expect(existsSync((fixture.getStream() as ReadStream).path)).toBe(false);
    }
  );

  it('cleans its spool and does not retry a failed backend connection', async () => {
    const fixture = setup();
    let spoolPath: string;
    fixture.request.mockImplementationOnce(async options => {
      spoolPath = options.data.path;
      throw Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    });
    await fixture.middleware.resolve()(fixture.ctx, vi.fn());
    expect(fixture.ctx.status).toBe(503);
    expect(fixture.request).toHaveBeenCalledTimes(1);
    expect(existsSync(spoolPath)).toBe(false);
  });

  it('preserves committed success when local spool cleanup fails', async () => {
    const fixture = setup();
    let directory: string;
    const cleanupError = Object.assign(new Error('disk busy'), { code: 'EBUSY' });
    fixture.request.mockImplementationOnce(async options => {
      directory = dirname(options.data.path);
      for await (const chunk of options.data) fixture.received.push(Buffer.from(chunk));
      return { status: 201, data: { id: 42 }, headers: {} };
    });
    vi.mocked(rm).mockRejectedValueOnce(cleanupError);
    try {
      await expect(fixture.middleware.resolve()(fixture.ctx, vi.fn())).resolves.toBeUndefined();
      expect(fixture.ctx.status).toBe(201);
      expect(fixture.ctx.body).toEqual({ id: 42 });
      expect(fixture.request).toHaveBeenCalledTimes(1);
      expect(fixture.ctx.logger.warn).toHaveBeenCalledWith('Gateway upload spool cleanup failed', {
        directory,
        error: cleanupError
      });
    } finally {
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  });

  it('does not contact the backend after an aborted input stream', async () => {
    const fixture = setup();
    fixture.ctx.req = Readable.from(
      (async function* () {
        yield Buffer.from('partial multipart');
        throw Object.assign(new Error('aborted'), { code: 'ECONNRESET' });
      })()
    );
    await fixture.middleware.resolve()(fixture.ctx, vi.fn());
    expect(fixture.ctx.status).toBe(502);
    expect(fixture.request).not.toHaveBeenCalled();
  });

  it('leaves non-upload multipart routes on the existing parsed-body path', async () => {
    const fixture = setup('/api/v1/assets/other');
    await fixture.middleware.resolve()(fixture.ctx, vi.fn());
    expect(fixture.request.mock.calls[0][0].data).toBe(fixture.ctx.request.body);
    expect(fixture.request.mock.calls[0][0].timeout).toBe(30_000);
  });

  it('preserves the existing extended timeout for content studio requests', async () => {
    const fixture = setup('/api/v1/content-studio/generate');
    fixture.middleware.routes = [{ path: '/api/v1/content-studio/*', target: 'http://studio' }];
    await fixture.middleware.resolve()(fixture.ctx, vi.fn());
    expect(fixture.request.mock.calls[0][0].timeout).toBe(120_000);
  });

  it('rejects declared oversized bodies before contacting the backend', async () => {
    const fixture = setup(undefined, undefined, String(102 * 1024 * 1024));
    await fixture.middleware.resolve()(fixture.ctx, vi.fn());
    expect(fixture.ctx.status).toBe(413);
    expect(fixture.request).not.toHaveBeenCalled();
  });

  it('counts actual chunked bytes before contacting the backend', async () => {
    const fixture = setup(
      undefined,
      Array.from({ length: 102 }, () => Buffer.alloc(1024 * 1024))
    );
    await fixture.middleware.resolve()(fixture.ctx, vi.fn());
    expect(fixture.ctx.status).toBe(413);
    expect(fixture.request).not.toHaveBeenCalled();
  });

  it('does not spool or forward multipart without a verified identity', async () => {
    const fixture = setup();
    fixture.ctx.state.user = undefined;
    await fixture.middleware.resolve()(fixture.ctx, vi.fn());
    expect(fixture.ctx.status).toBe(401);
    expect(fixture.request).not.toHaveBeenCalled();
  });
});
