import { Controller, Post, Get, Query, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { PlatformAccountService } from '../service/platform-account.service';
import { CreatePlatformAccountDto, QueryPlatformAccountDto } from '../dto/platform-account.dto';

@Controller('/api/platform-account')
export class PlatformAccountController {
  @Inject()
  ctx!: Context;

  @Inject()
  platformAccountService!: PlatformAccountService;

  @Post('/')
  @Validate()
  async createAccount(@Body() dto: CreatePlatformAccountDto) {
    const corpId = 1; // TODO: 从JWT获取

    const account = await this.platformAccountService.createAccount(corpId, dto);
    return {
      success: true,
      data: account,
      message: '账号创建成功',
    };
  }

  @Get('/list')
  @Validate()
  async queryAccounts(@Query() query: QueryPlatformAccountDto) {
    const corpId = 1; // TODO: 从JWT获取

    const result = await this.platformAccountService.queryAccounts(corpId, query);
    return {
      success: true,
      data: result,
    };
  }
}

