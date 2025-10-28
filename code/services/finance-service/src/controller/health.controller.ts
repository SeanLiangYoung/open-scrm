import { Controller, Get, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { InjectDataSource } from '@midwayjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('/health')
export class HealthController {
  @Inject()
  ctx!: Context;

  @InjectDataSource()
  dataSource!: DataSource;

  @Get('/')
  async health() {
    try {
      await this.dataSource.query('SELECT 1');

      return {
        status: 'ok',
        service: 'finance-service',
        timestamp: new Date().toISOString(),
        database: 'connected',
      };
    } catch (error: any) {
      this.ctx.status = 503;
      return {
        status: 'error',
        service: 'finance-service',
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
      service: 'finance-service',
      timestamp: new Date().toISOString(),
    };
  }
}

