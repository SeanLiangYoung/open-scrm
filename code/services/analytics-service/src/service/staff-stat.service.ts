import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { StaffStatEntity } from '../entity/staff-stat.entity';
import { QueryStaffStatDto } from '../dto/stat-query.dto';

@Provide()
export class StaffStatService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(StaffStatEntity)
  staffStatRepository!: Repository<StaffStatEntity>;

  async queryStaffStat(corpId: number, query: QueryStaffStatDto) {
    const where: any = {
      corpId,
      statDate: Between(new Date(query.startDate), new Date(query.endDate)),
    };

    if (query.staffId) {
      where.staffId = query.staffId;
    }

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const [stats, total] = await this.staffStatRepository.findAndCount({
      where,
      order: {
        statDate: 'DESC',
        staffId: 'ASC',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      list: stats,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getStaffRanking(corpId: number, startDate: string, endDate: string, limit: number = 10) {
    const stats = await this.staffStatRepository.find({
      where: {
        corpId,
        statDate: Between(new Date(startDate), new Date(endDate)),
      },
    });

    // 按员工聚合
    const staffMap = new Map<number, any>();
    
    stats.forEach(stat => {
      const existing = staffMap.get(stat.staffId) || {
        staffId: stat.staffId,
        customerCount: 0,
        newCustomerCount: 0,
        messageSendCount: 0,
        taskCompletedCount: 0,
      };

      // 取最新的客户总数
      if (stat.customerCount > existing.customerCount) {
        existing.customerCount = stat.customerCount;
      }
      
      existing.newCustomerCount += stat.newCustomerCount;
      existing.messageSendCount += stat.messageSendCount;
      existing.taskCompletedCount += stat.taskCompletedCount;

      staffMap.set(stat.staffId, existing);
    });

    // 排序并取前N名
    const ranking = Array.from(staffMap.values())
      .sort((a, b) => b.newCustomerCount - a.newCustomerCount)
      .slice(0, limit);

    return ranking;
  }
}

