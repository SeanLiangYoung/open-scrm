import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { DailyStatEntity } from '../entity/daily-stat.entity';
import { QueryDailyStatDto } from '../dto/stat-query.dto';
import { summarizeDailyStatRange } from '../util/daily-stat-summary.util';
import dayjs from 'dayjs';

@Provide()
export class DailyStatService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(DailyStatEntity)
  dailyStatRepository!: Repository<DailyStatEntity>;

  async queryDailyStat(corpId: number, query: QueryDailyStatDto) {
    const stats = await this.dailyStatRepository.find({
      where: {
        corpId,
        statDate: Between(new Date(query.startDate), new Date(query.endDate)),
      },
      order: {
        statDate: 'ASC',
      },
    });

    return stats;
  }

  async getOverview(corpId: number, date?: string) {
    const d = date ? dayjs(date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

    const todayStat = await this.dailyStatRepository
      .createQueryBuilder('s')
      .where('s.corpId = :corpId', { corpId })
      .andWhere(`to_char(s.statDate, 'YYYY-MM-DD') = :d`, { d })
      .getOne();

    if (!todayStat) {
      return {
        newCustomerCount: 0,
        lostCustomerCount: 0,
        activeCustomerCount: 0,
        totalCustomerCount: 0,
        activeStaffCount: 0,
        totalStaffCount: 0,
        messageSendCount: 0,
        messageSuccessRate: 0,
        sopExecuteCount: 0,
        sopSuccessRate: 0,
      };
    }

    return {
      newCustomerCount: todayStat.newCustomerCount,
      lostCustomerCount: todayStat.lostCustomerCount,
      activeCustomerCount: todayStat.activeCustomerCount,
      totalCustomerCount: todayStat.totalCustomerCount,
      activeStaffCount: todayStat.activeStaffCount,
      totalStaffCount: todayStat.totalStaffCount,
      messageSendCount: todayStat.messageSendCount,
      messageSuccessRate:
        todayStat.messageSendCount > 0
          ? Number(((todayStat.messageSuccessCount / todayStat.messageSendCount) * 100).toFixed(2))
          : 0,
      sopExecuteCount: todayStat.sopExecuteCount,
      sopSuccessRate:
        todayStat.sopExecuteCount > 0
          ? Number(((todayStat.sopSuccessCount / todayStat.sopExecuteCount) * 100).toFixed(2))
          : 0,
    };
  }

  async getTrend(corpId: number, days: number = 7) {
    const endDate = dayjs().format('YYYY-MM-DD');
    const startDate = dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD');

    const stats = await this.queryDailyStat(corpId, {
      startDate,
      endDate,
    });

    return {
      dates: stats.map(s => dayjs(s.statDate).format('MM-DD')),
      newCustomers: stats.map(s => s.newCustomerCount),
      lostCustomers: stats.map(s => s.lostCustomerCount),
      activeCustomers: stats.map(s => s.activeCustomerCount),
      messageSends: stats.map(s => s.messageSendCount),
    };
  }

  /**
   * 区间内：可累加指标求和 + 最后一日快照（与迭代计划「summary」语义对齐）
   */
  async getSummary(corpId: number, query: QueryDailyStatDto) {
    const stats = await this.queryDailyStat(corpId, query);
    const mapped = stats.map(s => ({
      statDate: s.statDate,
      newCustomerCount: s.newCustomerCount,
      lostCustomerCount: s.lostCustomerCount,
      activeCustomerCount: s.activeCustomerCount,
      totalCustomerCount: s.totalCustomerCount,
      activeStaffCount: s.activeStaffCount,
      totalStaffCount: s.totalStaffCount,
      messageSendCount: s.messageSendCount,
      messageSuccessCount: s.messageSuccessCount,
      messageFailCount: s.messageFailCount,
      sopExecuteCount: s.sopExecuteCount,
      sopSuccessCount: s.sopSuccessCount,
    }));
    const core = summarizeDailyStatRange(mapped);
    const msgSend = core.additive.messageSendCount;
    const msgOk = core.additive.messageSuccessCount;
    const sopEx = core.additive.sopExecuteCount;
    const sopOk = core.additive.sopSuccessCount;
    return {
      startDate: query.startDate,
      endDate: query.endDate,
      additive: core.additive,
      snapshotAtEnd: core.snapshotAtEnd,
      rates: {
        messageSuccessRate: msgSend > 0 ? Number(((msgOk / msgSend) * 100).toFixed(2)) : 0,
        sopSuccessRate: sopEx > 0 ? Number(((sopOk / sopEx) * 100).toFixed(2)) : 0,
      },
    };
  }
}

