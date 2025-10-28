import { Controller, Post, Get, Query, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { ChannelCodeService } from '../service/channel-code.service';
import { CreateChannelCodeDto, QueryChannelCodeDto } from '../dto/channel-code.dto';

@Controller('/api/channel-code')
export class ChannelCodeController {
  @Inject()
  ctx!: Context;

  @Inject()
  channelCodeService!: ChannelCodeService;

  @Post('/')
  @Validate()
  async createChannelCode(@Body() dto: CreateChannelCodeDto) {
    const corpId = 1; // TODO: 从JWT获取

    const code = await this.channelCodeService.createChannelCode(corpId, dto);
    return {
      success: true,
      data: code,
      message: '渠道活码创建成功',
    };
  }

  @Get('/list')
  @Validate()
  async queryChannelCodes(@Query() query: QueryChannelCodeDto) {
    const corpId = 1; // TODO: 从JWT获取

    const result = await this.channelCodeService.queryChannelCodes(corpId, query);
    return {
      success: true,
      data: result,
    };
  }
}

