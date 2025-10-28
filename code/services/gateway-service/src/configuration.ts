import { Configuration, App } from '@midwayjs/core';
import * as koa from '@midwayjs/koa';
import * as validate from '@midwayjs/validate';
import * as info from '@midwayjs/info';
import * as jwt from '@midwayjs/jwt';
import * as redis from '@midwayjs/redis';
import * as axios from '@midwayjs/axios';
import { join } from 'path';

@Configuration({
  imports: [
    koa,
    validate,
    info,
    jwt,
    redis,
    axios
  ],
  importConfigs: [join(__dirname, './config')]
})
export class MainConfiguration {
  @App('koa')
  app: koa.Application;

  async onReady() {
    // 应用启动完成
    console.log('✅ Gateway Service is ready');
  }
}

