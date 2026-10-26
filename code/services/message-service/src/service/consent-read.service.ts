import { Provide, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { ConsentRecordEntity } from '../entity/consent-record.entity';
import { ConsentReadPage } from '../dto/consent-read.dto';

export interface ConsentEvidenceView {
  id: string; purpose: 'marketing'; policyVersion: string | null; channel: string | null;
  locale: string | null; createdAt: string; revokedAt: string | null;
}
export interface CustomerConsentSnapshot extends ConsentReadPage {
  customerId: string; purpose: 'marketing'; observedAt: string; hasActiveMarketingConsent: boolean;
  activeCount: number; revokedCount: number; total: number; list: ConsentEvidenceView[];
}
function countNumber(value: unknown): number {
  if (!/^(0|[1-9]\d*)$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error('Unsafe consent count');
  return Number(value);
}
function evidenceId(value: unknown): string {
  if (!['number', 'string'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) ||
    (typeof value === 'number' && !Number.isSafeInteger(value))) throw new Error('Invalid consent evidence ID');
  return String(value);
}
const isoDate = (value: Date | string): string => new Date(value).toISOString();

@Provide()
export class ConsentReadService {
  @InjectEntityModel(ConsentRecordEntity)
  consentRepository!: Repository<ConsentRecordEntity>;

  async readCustomerConsent(corpId: number, customerId: number, pagination: ConsentReadPage): Promise<CustomerConsentSnapshot> {
    if (!Number.isSafeInteger(corpId) || corpId <= 0) throw new httpError.UnauthorizedError('缺少有效企业身份');
    if (!Number.isSafeInteger(customerId) || customerId <= 0 || !pagination ||
      !Number.isSafeInteger(pagination.page) || pagination.page < 1 || pagination.page > 100000 ||
      !Number.isSafeInteger(pagination.pageSize) || pagination.pageSize < 1 || pagination.pageSize > 100) {
      throw new httpError.BadRequestError('授权读取参数无效');
    }
    return this.consentRepository.manager.transaction('REPEATABLE READ', async manager => {
      await manager.query('SET TRANSACTION READ ONLY');
      const customer = await manager.query('SELECT id, statement_timestamp() AS observed_at FROM customer WHERE id = $1 AND corp_id = $2', [customerId, corpId]);
      if (customer.length === 0) throw new httpError.NotFoundError('客户不存在');
      const [counts] = await manager.query(`SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE revoked_at IS NULL) AS active_count,
        COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) AS revoked_count
        FROM consent_record WHERE corp_id = $1 AND subject_type = 'customer' AND subject_id = $2 AND purpose = 'marketing'`, [corpId, customerId]);
      const total = countNumber(counts.total), activeCount = countNumber(counts.active_count), revokedCount = countNumber(counts.revoked_count);
      if (activeCount + revokedCount !== total) throw new Error('Inconsistent consent counts');
      const rows = await manager.query(`SELECT id::text AS id, purpose, policy_version, channel, locale, created_at, revoked_at
        FROM consent_record WHERE corp_id = $1 AND subject_type = 'customer' AND subject_id = $2 AND purpose = 'marketing'
        ORDER BY created_at DESC, consent_record.id DESC LIMIT $3 OFFSET $4`, [corpId, customerId, pagination.pageSize, (pagination.page - 1) * pagination.pageSize]);
      return {
        customerId: String(customerId), purpose: 'marketing', observedAt: isoDate(customer[0].observed_at),
        hasActiveMarketingConsent: activeCount > 0, activeCount, revokedCount, total,
        page: pagination.page, pageSize: pagination.pageSize,
        list: rows.map((row: Record<string, any>) => ({
          id: evidenceId(row.id), purpose: 'marketing', policyVersion: row.policy_version,
          channel: row.channel, locale: row.locale, createdAt: isoDate(row.created_at),
          revokedAt: row.revoked_at == null ? null : isoDate(row.revoked_at),
        })),
      };
    });
  }
}
