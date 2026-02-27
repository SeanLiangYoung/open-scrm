import { Controller, Get, Inject, Query } from '@midwayjs/core';
import { HttpService } from '@midwayjs/axios';

@Controller('/health')
export class HealthController {
  @Get('/')
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'gateway-service',
      version: '1.0.0',
    };
  }
}

@Controller('/api')
export class HealthCheckProxyController {
  @Inject()
  httpService: HttpService;

  @Get('/health-check')
  async healthCheck(@Query('port') port: string) {
    if (!port || isNaN(Number(port))) {
      return { status: 'error', message: 'Invalid port' };
    }
    try {
      const res = await this.httpService.get(
        `http://localhost:${port}/health`,
        { timeout: 3000 }
      );
      return res.data;
    } catch {
      return { status: 'down', port: Number(port) };
    }
  }
}
