import { Provide } from '@midwayjs/core';
import { InjectDataSource } from '@midwayjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * 从 OLTP 表聚合写入 daily_stat（Sprint 4：定时任务 + 手动触发共用）
 */
@Provide()
export class DailyAggregationService {
  @InjectDataSource()
  dataSource!: DataSource;

  /**
   * 聚合某企业、某日（statDate 为 YYYY-MM-DD，按库时区 date 边界）
   */
  async aggregateForCorpAndDate(corpId: number, statDate: string): Promise<void> {
    const sql = `
      WITH cust AS (
        SELECT
          (SELECT COUNT(*)::int FROM customer c WHERE c.corp_id = $1
            AND c.create_time::date = $2::date) AS new_customer_count,
          (SELECT COUNT(*)::int FROM customer c WHERE c.corp_id = $1 AND c.status = 0) AS lost_customer_count,
          (SELECT COUNT(*)::int FROM customer c WHERE c.corp_id = $1 AND c.status = 1) AS active_customer_count,
          (SELECT COUNT(*)::int FROM customer c WHERE c.corp_id = $1) AS total_customer_count
      ),
      staff AS (
        SELECT
          (SELECT COUNT(*)::int FROM "user" u WHERE u.corp_id = $1 AND COALESCE(u.status, 1) = 1) AS active_staff_count,
          (SELECT COUNT(*)::int FROM "user" u WHERE u.corp_id = $1) AS total_staff_count
      ),
      msg AS (
        SELECT
          (SELECT COUNT(*)::int FROM message_log m WHERE m.corp_id = $1
            AND m.create_time::date = $2::date) AS message_send_count,
          (SELECT COUNT(*)::int FROM message_log m WHERE m.corp_id = $1
            AND m.create_time::date = $2::date AND m.send_status = 1) AS message_success_count,
          (SELECT COUNT(*)::int FROM message_log m WHERE m.corp_id = $1
            AND m.create_time::date = $2::date AND m.send_status = 2) AS message_fail_count
      ),
      sop AS (
        SELECT
          (SELECT COUNT(*)::int FROM sop_execution s WHERE s.corp_id = $1
            AND s.create_time::date = $2::date) AS sop_execute_count,
          (SELECT COUNT(*)::int FROM sop_execution s WHERE s.corp_id = $1
            AND s.create_time::date = $2::date AND s.complete_time IS NOT NULL) AS sop_success_count
      ),
      mass AS (
        SELECT
          (SELECT COUNT(*)::int FROM mass_task t WHERE t.corp_id = $1
            AND t.create_time::date = $2::date) AS mass_task_count,
          (SELECT COALESCE(SUM(t.success_count), 0)::int FROM mass_task t WHERE t.corp_id = $1
            AND t.create_time::date = $2::date) AS mass_send_count
      )
      INSERT INTO daily_stat (
        corp_id, stat_date,
        new_customer_count, lost_customer_count, active_customer_count, total_customer_count,
        active_staff_count, total_staff_count,
        message_send_count, message_success_count, message_fail_count,
        sop_execute_count, sop_success_count,
        mass_task_count, mass_send_count
      )
      SELECT $1, $2::date,
        cust.new_customer_count, cust.lost_customer_count, cust.active_customer_count, cust.total_customer_count,
        staff.active_staff_count, staff.total_staff_count,
        msg.message_send_count, msg.message_success_count, msg.message_fail_count,
        sop.sop_execute_count, sop.sop_success_count,
        mass.mass_task_count, mass.mass_send_count
      FROM cust, staff, msg, sop, mass
      ON CONFLICT (corp_id, stat_date) DO UPDATE SET
        new_customer_count = EXCLUDED.new_customer_count,
        lost_customer_count = EXCLUDED.lost_customer_count,
        active_customer_count = EXCLUDED.active_customer_count,
        total_customer_count = EXCLUDED.total_customer_count,
        active_staff_count = EXCLUDED.active_staff_count,
        total_staff_count = EXCLUDED.total_staff_count,
        message_send_count = EXCLUDED.message_send_count,
        message_success_count = EXCLUDED.message_success_count,
        message_fail_count = EXCLUDED.message_fail_count,
        sop_execute_count = EXCLUDED.sop_execute_count,
        sop_success_count = EXCLUDED.sop_success_count,
        mass_task_count = EXCLUDED.mass_task_count,
        mass_send_count = EXCLUDED.mass_send_count,
        update_time = CURRENT_TIMESTAMP
    `;
    await this.dataSource.query(sql, [corpId, statDate]);
  }

  /**
   * 对所有在 customer 表中出现过的 corp 聚合某日（供定时任务使用）
   */
  async aggregateAllCorpsForDate(statDate: string): Promise<{ corpCount: number; errors: string[] }> {
    const rows: { corp_id: number }[] = await this.dataSource.query(
      `SELECT DISTINCT corp_id FROM customer ORDER BY corp_id`
    );
    const errors: string[] = [];
    for (const r of rows) {
      try {
        await this.aggregateForCorpAndDate(Number(r.corp_id), statDate);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`corp=${r.corp_id}: ${msg}`);
      }
    }
    return { corpCount: rows.length, errors };
  }
}
