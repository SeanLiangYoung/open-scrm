import { Controller, Get } from '@midwayjs/core';

@Controller('/health')
export class HealthController {
  @Get('/')
  async check() {
    return {
      status: 'ok',
      service: 'customer-service',
      timestamp: new Date().toISOString(),
    };
  }
}

