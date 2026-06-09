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
        service: 'content-generation-service',
        timestamp: new Date().toISOString(),
        database: 'connected',
      };
    } catch (error: unknown) {
      this.ctx.status = 503;
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: 'error',
        service: 'content-generation-service',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: message,
      };
    }
  }
}
