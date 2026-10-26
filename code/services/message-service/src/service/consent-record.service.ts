import { httpError, Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ConsentRecordEntity } from '../entity/consent-record.entity';

@Provide()
export class ConsentRecordService {
  @InjectEntityModel(ConsentRecordEntity)
  consentRepository!: Repository<ConsentRecordEntity>;

  /** Capture a new grant; prior evidence is retained, including revoked grants. */
  async grantMarketingConsent(corpId: number, input: {
    customerId: number; policyVersion: string; channel: string; locale: string;
  }): Promise<ConsentRecordEntity> {
    return this.consentRepository.manager.transaction(async manager => {
      await this.lockCustomer(manager, corpId, input.customerId);
      const repo = manager.getRepository(ConsentRecordEntity);
      return repo.save(repo.create({
        corpId, subjectType: 'customer', subjectId: input.customerId,
        purpose: 'marketing', policyVersion: input.policyVersion,
        channel: input.channel, locale: input.locale, revokedAt: null,
      }));
    });
  }

  /** Revoke every active grant so an older duplicate cannot keep marketing enabled. */
  async revokeMarketingConsent(corpId: number, customerId: number): Promise<{ revokedCount: number }> {
    return this.consentRepository.manager.transaction(async manager => {
      await this.lockCustomer(manager, corpId, customerId);
      const result = await manager.getRepository(ConsentRecordEntity).update({
        corpId, subjectType: 'customer', subjectId: customerId,
        purpose: 'marketing', revokedAt: IsNull(),
      }, { revokedAt: new Date() });
      return { revokedCount: result.affected ?? 0 };
    });
  }

  private async lockCustomer(manager: import('typeorm').EntityManager, corpId: number, customerId: number) {
    // The existing deployment shares PostgreSQL with customer-service. Parameterized
    // tenant-scoped row lock serializes grant/revoke without a new schema constraint.
    const rows = await manager.query(
      'SELECT id FROM customer WHERE id = $1 AND corp_id = $2 FOR UPDATE',
      [customerId, corpId]
    );
    if (rows.length === 0) throw new httpError.NotFoundError('客户不存在');
  }

  /** 是否存在未撤回的 marketing 同意（当前仅校验 customer 主体） */
  async hasActiveMarketingConsentForCustomer(
    corpId: number,
    customerId: number
  ): Promise<boolean> {
    const row = await this.consentRepository.findOne({
      where: {
        corpId,
        subjectType: 'customer',
        subjectId: customerId,
        purpose: 'marketing',
        revokedAt: IsNull(),
      },
    });
    return !!row;
  }
}
