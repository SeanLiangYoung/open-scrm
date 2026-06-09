import { Controller, Post, Get, Query, Body, Inject, Param } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { PlatformAccountService } from '../service/platform-account.service';
import { CreatePlatformAccountDto, QueryPlatformAccountDto } from '../dto/platform-account.dto';
import { ConnectPlatformAccountDto } from '../dto/platform-oauth.dto';
import { getTenantContext } from '@scrm/server-common';

@Controller('/api/platform-account')
export class PlatformAccountController {
  @Inject()
  ctx!: Context;

  @Inject()
  platformAccountService!: PlatformAccountService;

  @Post('/')
  @Validate()
  async createAccount(@Body() dto: CreatePlatformAccountDto) {
    const { corpId } = getTenantContext(this.ctx);

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
    const { corpId } = getTenantContext(this.ctx);

    const result = await this.platformAccountService.queryAccounts(corpId, query);
    return {
      success: true,
      data: result,
    };
  }

  /** 本地开发：模拟 OAuth 回调，写入平台 access token */
  @Post('/:id/oauth')
  @Validate()
  async connectOAuth(@Param('id') id: string, @Body() dto: ConnectPlatformAccountDto) {
    const { corpId } = getTenantContext(this.ctx);
    const account = await this.platformAccountService.connectOAuth(
      corpId,
      Number(id),
      dto
    );
    return {
      success: true,
      data: account,
      message: '平台授权已更新',
    };
  }
}

