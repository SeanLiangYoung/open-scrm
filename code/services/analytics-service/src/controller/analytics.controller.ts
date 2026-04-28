import { Controller, Get, Post, Query, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { getTenantContext } from '@scrm/server-common';
import dayjs from 'dayjs';
import { DailyStatService } from '../service/daily-stat.service';
import { ChannelStatService } from '../service/channel-stat.service';
import { StaffStatService } from '../service/staff-stat.service';
import { DailyAggregationService } from '../service/daily-aggregation.service';
import {
  QueryDailyStatDto,
  QueryChannelStatDto,
  QueryStaffStatDto,
  OverviewStatDto,
  AggregateDailyDto,
} from '../dto/stat-query.dto';

/** 经网关统一前缀 `/api/v1/analytics/*`（与 gateway-service 配置一致） */
@Controller('/api/v1/analytics')
export class AnalyticsController {
  @Inject()
  ctx!: Context;

  @Inject()
  dailyStatService!: DailyStatService;

  @Inject()
  channelStatService!: ChannelStatService;

  @Inject()
  staffStatService!: StaffStatService;

  @Inject()
  dailyAggregationService!: DailyAggregationService;

  @Get('/overview')
  @Validate()
  async getOverview(@Query() query: OverviewStatDto) {
    const { corpId } = getTenantContext(this.ctx);

    const overview = await this.dailyStatService.getOverview(corpId, query.date);
    return {
      success: true,
      data: overview,
    };
  }

  /**
   * 区间汇总：可加指标求和 + 区间末日快照（客户/员工累计等）
   */
  @Get('/summary')
  @Validate()
  async getSummary(@Query() query: QueryDailyStatDto) {
    const { corpId } = getTenantContext(this.ctx);
    const data = await this.dailyStatService.getSummary(corpId, query);
    return {
      success: true,
      data,
    };
  }

  /**
   * 手动触发「当前企业」某日 daily_stat 聚合（默认当天，供 E2E / 运维）
   */
  @Post('/jobs/aggregate-daily')
  @Validate()
  async aggregateDaily(@Body() dto: AggregateDailyDto) {
    const { corpId } = getTenantContext(this.ctx);
    const statDate = dto.statDate || dayjs().format('YYYY-MM-DD');
    await this.dailyAggregationService.aggregateForCorpAndDate(corpId, statDate);
    return {
      success: true,
      data: { corpId, statDate },
      message: 'daily_stat 聚合完成',
    };
  }

  @Get('/trend')
  async getTrend(@Query('days') days?: number) {
    const { corpId } = getTenantContext(this.ctx);
    const trendDays = days ? parseInt(String(days), 10) : 7;

    const trend = await this.dailyStatService.getTrend(corpId, trendDays);
    return {
      success: true,
      data: trend,
    };
  }

  @Get('/daily')
  @Validate()
  async queryDailyStat(@Query() query: QueryDailyStatDto) {
    const { corpId } = getTenantContext(this.ctx);

    const stats = await this.dailyStatService.queryDailyStat(corpId, query);
    return {
      success: true,
      data: stats,
    };
  }

  @Get('/channel')
  @Validate()
  async queryChannelStat(@Query() query: QueryChannelStatDto) {
    const { corpId } = getTenantContext(this.ctx);

    const stats = await this.channelStatService.queryChannelStat(corpId, query);
    return {
      success: true,
      data: stats,
    };
  }

  @Get('/channel/ranking')
  async getChannelRanking(@Query() query: QueryChannelStatDto) {
    const { corpId } = getTenantContext(this.ctx);

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
    const { corpId } = getTenantContext(this.ctx);

    const result = await this.staffStatService.queryStaffStat(corpId, query);
    return {
      success: true,
      data: result,
    };
  }

  @Get('/staff/ranking')
  async getStaffRanking(@Query() query: QueryChannelStatDto) {
    const { corpId } = getTenantContext(this.ctx);

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
