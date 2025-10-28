import { Controller, Get } from '@midwayjs/core';

/**
 * 健康检查控制器
 */
@Controller('/health')
export class HealthController {
  @Get('/')
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'auth-service',
      version: '1.0.0'
    };
  }
}

