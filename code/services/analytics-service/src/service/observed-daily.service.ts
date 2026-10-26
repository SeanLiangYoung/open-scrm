import { Provide } from '@midwayjs/core';
import { InjectDataSource } from '@midwayjs/typeorm';
import { DataSource } from 'typeorm';
import { ObservedRow, parseObservedWindow, projectObservedDaily } from '../util/observed-daily.util';
@Provide()
export class ObservedDailyService {
  @InjectDataSource()
  dataSource!: DataSource;

  async read(corpId: number, query: unknown) {
    const window = parseObservedWindow(query);
    const rows: ObservedRow[] = await this.dataSource.query(`SELECT
      to_char(stat_date, 'YYYY-MM-DD') AS "date", update_time AS "observedAt",
      new_customer_count AS "newCustomerRecords", message_send_count AS "messageLogRecords",
      sop_execute_count AS "sopExecutionRecords", total_customer_count AS "totalCustomers",
      active_customer_count AS "normalCustomers", lost_customer_count AS "deletedCustomers"
      FROM daily_stat WHERE corp_id = $1 AND stat_date BETWEEN $2::date AND $3::date
      ORDER BY stat_date ASC`, [corpId, window.startDate, window.endDate]);
    return projectObservedDaily(window, rows);
  }
}
