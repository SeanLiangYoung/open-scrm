import { Job, IJob } from '@midwayjs/cron';
import { Inject } from '@midwayjs/core';
import dayjs from 'dayjs';
import { DailyAggregationService } from '../service/daily-aggregation.service';

/**
 * 每日凌晨聚合「上一自然日」全企业 daily_stat（失败写入单条日志，不抛毁进程）
 */
@Job({
  cronTime: '0 3 * * *',
  start: true,
})
export class DailyStatAggregationJob implements IJob {
  @Inject()
  dailyAggregationService!: DailyAggregationService;

  async onTick() {
    const statDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const { corpCount, errors } = await this.dailyAggregationService.aggregateAllCorpsForDate(statDate);
    if (errors.length) {
      console.error('[DailyStatAggregationJob]', statDate, 'errors:', errors.slice(0, 5));
    } else {
      console.log('[DailyStatAggregationJob]', statDate, 'ok corps=', corpCount);
    }
  }
}
