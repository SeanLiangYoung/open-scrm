import { test, expect } from '@playwright/test';

const GATEWAY = process.env.GATEWAY_URL || 'http://127.0.0.1:17000';

async function loginAccessToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await request.post(`${GATEWAY}/api/v1/auth/login`, {
    data: { username: 'admin', password: 'Admin@123' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  return body.accessToken as string;
}

async function pollGenerationJob(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  jobId: number
) {
  const auth = { Authorization: `Bearer ${token}` };
  for (let i = 0; i < 30; i += 1) {
    const res = await request.get(`${GATEWAY}/api/v1/content-studio/jobs/${jobId}`, {
      headers: auth,
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    const job = body.data?.job ?? body.job;
    const variants = body.data?.variants ?? body.variants ?? [];
    if (job?.status === 'succeeded') {
      return { job, variants };
    }
    if (job?.status === 'failed') {
      throw new Error(job.errorMessage || 'generation failed');
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('generation job timed out');
}

test.describe('Content Studio — 创作中心 API 闭环', () => {
  test('创建源 → 生成 → 推送草稿 → 发布（mock LLM + mock publish）', async ({ request }) => {
    const health = await request.get(`${GATEWAY}/health`).catch(() => null);
    test.skip(!health?.ok(), 'Gateway 未启动');

    const token = await loginAccessToken(request);
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const accountRes = await request.post(`${GATEWAY}/api/platform-account`, {
      headers: auth,
      data: {
        platform: 'xiaohongshu',
        accountName: `studio-e2e-${Date.now()}`,
        accessToken: 'e2e-dev-token',
      },
    });
    if (accountRes.status() >= 500) {
      test.skip(true, 'acquisition-service 不可用');
    }
    expect(accountRes.ok(), await accountRes.text()).toBeTruthy();
    const accountId = (await accountRes.json()).data.id as number;

    const sourceRes = await request.post(`${GATEWAY}/api/v1/content-studio/sources`, {
      headers: auth,
      data: {
        title: `E2E 创作中心 ${Date.now()}`,
        body: '端到端测试用的核心内容源正文，足够长。',
        summary: 'E2E summary',
        keywords: ['E2E', '创作中心'],
        kbEnabled: false,
      },
    });
    if (sourceRes.status() >= 500 || sourceRes.status() === 503) {
      test.skip(true, 'content-generation-service 不可用');
    }
    expect(sourceRes.ok(), await sourceRes.text()).toBeTruthy();
    const sourceId = (await sourceRes.json()).data.id as number;

    const generateRes = await request.post(
      `${GATEWAY}/api/v1/content-studio/sources/${sourceId}/generate`,
      {
        headers: auth,
        data: {
          channels: ['tweet', 'xhs_graphic'],
          kbEnabled: false,
        },
      }
    );
    expect(generateRes.ok(), await generateRes.text()).toBeTruthy();
    const generateBody = await generateRes.json();
    const generateData = generateBody.data ?? generateBody;

    let variants = generateData.variants ?? [];
    if (generateData.status === 'pending' && generateData.jobId) {
      const polled = await pollGenerationJob(request, token, generateData.jobId as number);
      variants = polled.variants;
    }

    expect(variants.length).toBeGreaterThan(0);
    const variantId = variants[0].id as number;

    const pushRes = await request.post(
      `${GATEWAY}/api/v1/content-studio/variants/${variantId}/push-draft`,
      {
        headers: auth,
        data: {
          platform: 'xiaohongshu',
          accountId,
          contentType: 1,
        },
      }
    );
    expect(pushRes.ok(), await pushRes.text()).toBeTruthy();
    const pushBody = await pushRes.json();
    const contentId = (pushBody.data?.contentId ?? pushBody.contentId) as number;
    expect(contentId).toBeGreaterThan(0);

    const publishRes = await request.post(
      `${GATEWAY}/api/v1/acquisition/contents/${contentId}/publish`,
      { headers: auth }
    );
    expect(publishRes.ok(), await publishRes.text()).toBeTruthy();
    const published = (await publishRes.json()).data;
    expect(published.status).toBe(1);
    expect(published.platformContentId).toMatch(/^xhs-mock-/);

    const statusRes = await request.get(
      `${GATEWAY}/api/v1/acquisition/contents/${contentId}/publish-status`,
      { headers: auth }
    );
    expect(statusRes.ok()).toBeTruthy();
    expect(((await statusRes.json()).data.status as number)).toBe(1);
  });
});
