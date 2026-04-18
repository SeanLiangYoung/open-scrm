import { Controller, Get, Inject } from '@midwayjs/core';
import { InjectDataSource } from '@midwayjs/typeorm';
import { RedisService } from '@midwayjs/redis';
import { DataSource } from 'typeorm';

/**
 * 经网关暴露的集成服务探测（路径与 gateway /api/v1/integration/* 一致）
 */
@Controller('/api/v1/integration')
export class IntegrationApiController {
  @InjectDataSource()
  dataSource!: DataSource;

  @Inject()
  redisService!: RedisService;

  @Get('/health')
  async health() {
    let database: 'connected' | 'disconnected' = 'disconnected';
    let redis: 'connected' | 'disconnected' = 'disconnected';
    let dbError: string | undefined;

    try {
      await this.dataSource.query('SELECT 1');
      database = 'connected';
    } catch (error: any) {
      dbError = error?.message || 'Unknown error';
    }

    try {
      const pingKey = 'integration:health:ping';
      await this.redisService.set(pingKey, '1', 'EX', 10);
      const v = await this.redisService.get(pingKey);
      redis = v === '1' ? 'connected' : 'disconnected';
    } catch {
      redis = 'disconnected';
    }

    const ok = database === 'connected' && redis === 'connected';
    return {
      status: ok ? 'ok' : 'error',
      service: 'integration-service',
      timestamp: new Date().toISOString(),
      database,
      redis,
      ...(dbError ? { error: dbError } : {}),
    };
  }
}
