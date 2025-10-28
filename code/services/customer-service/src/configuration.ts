import { Configuration, App } from '@midwayjs/core';
import * as koa from '@midwayjs/koa';
import * as validate from '@midwayjs/validate';
import * as info from '@midwayjs/info';
import * as typeorm from '@midwayjs/typeorm';
import * as redis from '@midwayjs/redis';
import { join } from 'path';

@Configuration({
  imports: [
    koa,
    validate,
    typeorm,
    redis,
    {
      component: info,
      enabledEnvironment: ['local'],
    },
  ],
  importConfigs: [join(__dirname, './config')],
})
export class MainConfiguration {
  @App('koa')
  app!: koa.Application;

  async onReady() {
    // 应用启动完成
    console.log('Customer Service Ready on port:', this.app.getConfig('koa.port'));
  }
}

