import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { DailyStatEntity } from '../entity/daily-stat.entity';
import { QueryDailyStatDto } from '../dto/stat-query.dto';
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
    const statDate = date ? new Date(date) : new Date();
    
    const todayStat = await this.dailyStatRepository.findOne({
      where: {
        corpId,
        statDate,
      },
    });

    if (!todayStat) {
      // 返回默认值
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
      messageSuccessRate: todayStat.messageSendCount > 0 
        ? Number(((todayStat.messageSuccessCount / todayStat.messageSendCount) * 100).toFixed(2))
        : 0,
      sopExecuteCount: todayStat.sopExecuteCount,
      sopSuccessRate: todayStat.sopExecuteCount > 0
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
}

