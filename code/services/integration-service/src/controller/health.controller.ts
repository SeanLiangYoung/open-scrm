import { Controller, Get, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { InjectDataSource } from '@midwayjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * 健康检查控制器
 */
@Controller('/health')
export class HealthController {
  @Inject()
  ctx!: Context;

  @InjectDataSource()
  dataSource!: DataSource;

  @Get('/')
  async health() {
    try {
      // 检查数据库连接
      await this.dataSource.query('SELECT 1');
      
      return {
        status: 'ok',
        service: 'integration-service',
        timestamp: new Date().toISOString(),
        database: 'connected',
      };
    } catch (error: any) {
      this.ctx.status = 503;
      return {
        status: 'error',
        service: 'integration-service',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error?.message || 'Unknown error',
      };
    }
  }

  @Get('/ready')
  async ready() {
    return {
      status: 'ready',
      service: 'integration-service',
      timestamp: new Date().toISOString(),
    };
  }
}

