import { Controller, Get, Post, Body, Query, Param, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { getTenantContext } from '@scrm/server-common';
import { ChannelCodeService } from '../service/channel-code.service';
import { CreateChannelCodeDto, QueryChannelCodeDto, IngestChannelScanDto } from '../dto/channel-code.dto';

/**
 * 经网关统一前缀 `/api/v1/acquisition/*`（与 gateway 配置一致）
 */
@Controller('/api/v1/acquisition')
export class AcquisitionApiController {
  @Inject()
  ctx!: Context;

  @Inject()
  channelCodeService!: ChannelCodeService;

  @Post('/channel-codes')
  @Validate()
  async create(@Body() dto: CreateChannelCodeDto) {
    const { corpId } = getTenantContext(this.ctx);
    const code = await this.channelCodeService.createChannelCode(corpId, dto);
    return {
      success: true,
      data: this.channelCodeService.toPublicChannel(code),
      message: '渠道活码创建成功',
    };
  }

  @Get('/channel-codes')
  @Validate()
  async list(@Query() query: QueryChannelCodeDto) {
    const { corpId } = getTenantContext(this.ctx);
    const result = await this.channelCodeService.queryChannelCodes(corpId, query);
    return {
      success: true,
      data: {
        ...result,
        list: result.list.map(c => this.channelCodeService.toPublicChannel(c)),
      },
    };
  }

  @Get('/channel-codes/:id')
  async getOne(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);
    const code = await this.channelCodeService.getById(corpId, parseInt(id, 10));
    if (!code) {
      this.ctx.status = 404;
      return { success: false, message: '活码不存在' };
    }
    return {
      success: true,
      data: this.channelCodeService.toPublicChannel(code),
    };
  }

  /**
   * 模拟「企微/集成侧」扫码回写（Sprint 5）；生产应由真实回调链路调用等价逻辑。
   * 支持 `externalEventId` 幂等：相同 eventId 24h 内仅生效一次。
   */
  @Post('/channel-codes/:id/ingest-scan')
  @Validate()
  async ingestScan(@Param('id') id: string, @Body() dto: IngestChannelScanDto) {
    const { corpId } = getTenantContext(this.ctx);
    const data = await this.channelCodeService.recordScanEvent(
      corpId,
      parseInt(id, 10),
      dto.externalEventId
    );
    return {
      success: true,
      data,
      message: data.replayed ? '重复事件已忽略（幂等）' : '扫码已计入',
    };
  }
}
