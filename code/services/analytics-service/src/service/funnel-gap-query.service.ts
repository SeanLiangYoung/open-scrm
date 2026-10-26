import { Provide } from '@midwayjs/core';
import { InjectDataSource } from '@midwayjs/typeorm';
import { DataSource } from 'typeorm';

const ATTRIBUTION_HINT_SQL = (alias: string) => `
  ${alias}.extra IS NOT NULL
  AND jsonb_typeof(${alias}.extra::jsonb) = 'object'
  AND (
    ${alias}.extra::jsonb ? 'utm_campaign'
    OR ${alias}.extra::jsonb ? 'utm_source'
    OR ${alias}.extra::jsonb ? 'utm_medium'
    OR ${alias}.extra::jsonb ? 'utm_term'
    OR ${alias}.extra::jsonb ? 'utm_content'
    OR ${alias}.extra::jsonb ? 'region_pack_id'
    OR ${alias}.extra::jsonb ? 'link_id'
  )
`;

/**
 * ANA-01 切片：从 OLTP 读 message_log / customer / channel_scan_touch 聚合漏斗分子分母。
 * 单条 SQL、参数化 corp + 时间窗，避免 N+1。
 */
@Provide()
export class FunnelGapQueryService {
  @InjectDataSource()
  dataSource!: DataSource;

  async aggregateOltp(
    corpId: number,
    start: Date,
    endExclusive: Date
  ): Promise<{
    sendsTotal: number;
    sendsWithTouchHint: number;
    customersTotal: number;
    customersWithAttribution: number;
    channelScanTouchCount: number;
  }> {
    const hintM = ATTRIBUTION_HINT_SQL('m');
    const sql = `
      SELECT
        (
          SELECT COUNT(*)::int
          FROM message_log m
          WHERE m.corp_id = $1
            AND m.send_status = 1
            AND m.create_time >= $2::timestamptz
            AND m.create_time < $3::timestamptz
        ) AS "sendsTotal",
        (
          SELECT COUNT(*)::int
          FROM message_log m
          WHERE m.corp_id = $1
            AND m.send_status = 1
            AND m.create_time >= $2::timestamptz
            AND m.create_time < $3::timestamptz
            AND (${hintM})
        ) AS "sendsWithTouchHint",
        (
          SELECT COUNT(*)::int
          FROM customer c
          WHERE c.corp_id = $1
        ) AS "customersTotal",
        (
          SELECT COUNT(DISTINCT m.target_id)::int
          FROM message_log m
          INNER JOIN customer attributed_customer
            ON attributed_customer.id = m.target_id
            AND attributed_customer.corp_id = $1
          WHERE m.corp_id = $1
            AND m.target_type = 1
            AND m.send_status = 1
            AND m.create_time >= $2::timestamptz
            AND m.create_time < $3::timestamptz
            AND (${hintM})
        ) AS "customersWithAttribution",
        (
          SELECT COUNT(*)::int
          FROM channel_scan_touch t
          WHERE t.corp_id = $1
            AND t.create_time >= $2::timestamptz
            AND t.create_time < $3::timestamptz
        ) AS "channelScanTouchCount"
    `;

    const raw = await this.dataSource.query(sql, [corpId, start.toISOString(), endExclusive.toISOString()]);
    const row = raw?.[0] ?? {};

    const n = (v: unknown) => {
      const x = Number(v);
      return Number.isFinite(x) ? x : 0;
    };

    return {
      sendsTotal: n(row.sendsTotal),
      sendsWithTouchHint: n(row.sendsWithTouchHint),
      customersTotal: n(row.customersTotal),
      customersWithAttribution: n(row.customersWithAttribution),
      channelScanTouchCount: n(row.channelScanTouchCount),
    };
  }
}
