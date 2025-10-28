import { Controller, Get, Query, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { DailyStatService } from '../service/daily-stat.service';
import { ChannelStatService } from '../service/channel-stat.service';
import { StaffStatService } from '../service/staff-stat.service';
import {
  QueryDailyStatDto,
  QueryChannelStatDto,
  QueryStaffStatDto,
  OverviewStatDto,
} from '../dto/stat-query.dto';

@Controller('/api/analytics')
export class AnalyticsController {
  @Inject()
  ctx!: Context;

  @Inject()
  dailyStatService!: DailyStatService;

  @Inject()
  channelStatService!: ChannelStatService;

  @Inject()
  staffStatService!: StaffStatService;

  @Get('/overview')
  @Validate()
  async getOverview(@Query() query: OverviewStatDto) {
    const corpId = 1; // TODO: 从JWT获取

    const overview = await this.dailyStatService.getOverview(corpId, query.date);
    return {
      success: true,
      data: overview,
    };
  }

  @Get('/trend')
  async getTrend(@Query('days') days?: number) {
    const corpId = 1; // TODO: 从JWT获取
    const trendDays = days ? parseInt(String(days)) : 7;

    const trend = await this.dailyStatService.getTrend(corpId, trendDays);
    return {
      success: true,
      data: trend,
    };
  }

  @Get('/daily')
  @Validate()
  async queryDailyStat(@Query() query: QueryDailyStatDto) {
    const corpId = 1; // TODO: 从JWT获取

    const stats = await this.dailyStatService.queryDailyStat(corpId, query);
    return {
      success: true,
      data: stats,
    };
  }

  @Get('/channel')
  @Validate()
  async queryChannelStat(@Query() query: QueryChannelStatDto) {
    const corpId = 1; // TODO: 从JWT获取

    const stats = await this.channelStatService.queryChannelStat(corpId, query);
    return {
      success: true,
      data: stats,
    };
  }

  @Get('/channel/ranking')
  async getChannelRanking(@Query() query: QueryChannelStatDto) {
    const corpId = 1; // TODO: 从JWT获取

    const ranking = await this.channelStatService.getChannelRanking(
      corpId,
      query.startDate,
      query.endDate
    );
    return {
      success: true,
      data: ranking,
    };
  }

  @Get('/staff')
  @Validate()
  async queryStaffStat(@Query() query: QueryStaffStatDto) {
    const corpId = 1; // TODO: 从JWT获取

    const result = await this.staffStatService.queryStaffStat(corpId, query);
    return {
      success: true,
      data: result,
    };
  }

  @Get('/staff/ranking')
  async getStaffRanking(@Query() query: QueryChannelStatDto) {
    const corpId = 1; // TODO: 从JWT获取

    const ranking = await this.staffStatService.getStaffRanking(
      corpId,
      query.startDate,
      query.endDate
    );
    return {
      success: true,
      data: ranking,
    };
  }
}

