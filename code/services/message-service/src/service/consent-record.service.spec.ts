import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IsNull } from 'typeorm';
import { ConsentRecordService } from './consent-record.service';
import type { Repository } from 'typeorm';
import type { ConsentRecordEntity } from '../entity/consent-record.entity';

function makeService(repo: Partial<Repository<ConsentRecordEntity>>) {
  const svc = new ConsentRecordService();
  (svc as unknown as { consentRepository: Partial<Repository<ConsentRecordEntity>> }).consentRepository =
    repo as Repository<ConsentRecordEntity>;
  return svc;
}

describe('ConsentRecordService.hasActiveMarketingConsentForCustomer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('存在未撤回 marketing 记录时返回 true', async () => {
    const findOne = vi.fn().mockResolvedValue({ id: 1, revokedAt: null });
    const svc = makeService({ findOne });
    const ok = await svc.hasActiveMarketingConsentForCustomer(1, 1);
    expect(ok).toBe(true);
    expect(findOne).toHaveBeenCalledWith({
      where: {
        corpId: 1,
        subjectType: 'customer',
        subjectId: 1,
        purpose: 'marketing',
        revokedAt: IsNull(),
      },
    });
  });

  it('无记录时返回 false', async () => {
    const svc = makeService({ findOne: vi.fn().mockResolvedValue(null) });
    expect(await svc.hasActiveMarketingConsentForCustomer(1, 99)).toBe(false);
  });
});
