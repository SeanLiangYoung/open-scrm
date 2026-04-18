import { Controller, Get } from '@midwayjs/core';
import { InjectDataSource } from '@midwayjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * 经网关暴露的集成服务探测（路径与 gateway /api/v1/integration/* 一致）
 */
@Controller('/api/v1/integration')
export class IntegrationApiController {
  @InjectDataSource()
  dataSource!: DataSource;

  @Get('/health')
  async health() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        service: 'integration-service',
        timestamp: new Date().toISOString(),
        database: 'connected',
      };
    } catch (error: any) {
      return {
        status: 'error',
        service: 'integration-service',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error?.message || 'Unknown error',
      };
    }
  }
}
