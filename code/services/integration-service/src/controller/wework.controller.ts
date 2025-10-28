import { Controller, Get, Post, Put, Del, Body, Param, Query, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { WeworkApiService } from '../service/wework-api.service';
import { WeworkSyncService } from '../service/wework-sync.service';
import { CreateWeworkConfigDto, UpdateWeworkConfigDto } from '../dto/wework-config.dto';
import { TriggerSyncDto, QuerySyncLogDto } from '../dto/sync.dto';

/**
 * 企业微信集成控制器
 */
@Controller('/api/wework')
export class WeworkController {
  @Inject()
  ctx!: Context;

  @Inject()
  weworkApiService!: WeworkApiService;

  @Inject()
  weworkSyncService!: WeworkSyncService;

  /**
   * 获取企业微信配置
   */
  @Get('/config')
  async getConfig() {
    const config = await this.weworkApiService.getConfig();
    return {
      success: true,
      data: config,
    };
  }

  /**
   * 创建企业微信配置
   */
  @Post('/config')
  @Validate()
  async createConfig(@Body() dto: CreateWeworkConfigDto) {
    const config = await this.weworkApiService.createConfig(dto);
    return {
      success: true,
      data: config,
      message: '配置创建成功',
    };
  }

  /**
   * 更新企业微信配置
   */
  @Put('/config/:id')
  @Validate()
  async updateConfig(@Param('id') id: string, @Body() dto: UpdateWeworkConfigDto) {
    const config = await this.weworkApiService.updateConfig(id, dto);
    return {
      success: true,
      data: config,
      message: '配置更新成功',
    };
  }

  /**
   * 删除企业微信配置
   */
  @Del('/config/:id')
  async deleteConfig(@Param('id') id: string) {
    await this.weworkApiService.deleteConfig(id);
    return {
      success: true,
      message: '配置删除成功',
    };
  }

  /**
   * 测试企业微信连接
   */
  @Post('/config/test')
  async testConnection() {
    const result = await this.weworkApiService.testConnection();
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取Access Token
   */
  @Get('/token')
  async getAccessToken() {
    const token = await this.weworkApiService.getAccessToken();
    return {
      success: true,
      data: { token },
    };
  }

  /**
   * 触发数据同步
   */
  @Post('/sync')
  @Validate()
  async triggerSync(@Body() dto: TriggerSyncDto) {
    const result = await this.weworkSyncService.triggerSync(dto.syncType, dto.force);
    return {
      success: true,
      data: result,
      message: '同步任务已启动',
    };
  }

  /**
   * 查询同步日志
   */
  @Get('/sync/logs')
  @Validate()
  async getSyncLogs(@Query() query: QuerySyncLogDto) {
    const result = await this.weworkSyncService.getSyncLogs(query);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取同步状态
   */
  @Get('/sync/status')
  async getSyncStatus() {
    const status = await this.weworkSyncService.getSyncStatus();
    return {
      success: true,
      data: status,
    };
  }

  /**
   * 同步部门数据
   */
  @Post('/sync/departments')
  async syncDepartments() {
    const result = await this.weworkSyncService.syncDepartments();
    return {
      success: true,
      data: result,
      message: '部门同步完成',
    };
  }

  /**
   * 同步员工数据
   */
  @Post('/sync/users')
  async syncUsers() {
    const result = await this.weworkSyncService.syncUsers();
    return {
      success: true,
      data: result,
      message: '员工同步完成',
    };
  }

  /**
   * 同步客户数据
   */
  @Post('/sync/customers')
  async syncCustomers() {
    const result = await this.weworkSyncService.syncCustomers();
    return {
      success: true,
      data: result,
      message: '客户同步完成',
    };
  }
}

