import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { ChannelStatEntity } from '../entity/channel-stat.entity';
import { QueryChannelStatDto } from '../dto/stat-query.dto';

@Provide()
export class ChannelStatService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(ChannelStatEntity)
  channelStatRepository!: Repository<ChannelStatEntity>;

  async queryChannelStat(corpId: number, query: QueryChannelStatDto) {
    const where: any = {
      corpId,
      statDate: Between(new Date(query.startDate), new Date(query.endDate)),
    };

    if (query.channel) {
      where.channel = query.channel;
    }

    const stats = await this.channelStatRepository.find({
      where,
      order: {
        statDate: 'ASC',
        channel: 'ASC',
      },
    });

    return stats;
  }

  async getChannelRanking(corpId: number, startDate: string, endDate: string) {
    const stats = await this.queryChannelStat(corpId, {
      startDate,
      endDate,
    });

    // 按渠道聚合
    const channelMap = new Map<string, any>();
    
    stats.forEach(stat => {
      const existing = channelMap.get(stat.channel) || {
        channel: stat.channel,
        scanCount: 0,
        addCustomerCount: 0,
        conversionRate: 0,
      };

      existing.scanCount += stat.scanCount;
      existing.addCustomerCount += stat.addCustomerCount;

      channelMap.set(stat.channel, existing);
    });

    // 计算转化率并排序
    const ranking = Array.from(channelMap.values()).map(item => ({
      ...item,
      conversionRate: item.scanCount > 0 
        ? Number(((item.addCustomerCount / item.scanCount) * 100).toFixed(2))
        : 0,
    })).sort((a, b) => b.addCustomerCount - a.addCustomerCount);

    return ranking;
  }
}

