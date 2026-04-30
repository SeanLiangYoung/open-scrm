import { Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ConsentRecordEntity } from '../entity/consent-record.entity';

@Provide()
export class ConsentRecordService {
  @InjectEntityModel(ConsentRecordEntity)
  consentRepository!: Repository<ConsentRecordEntity>;

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
