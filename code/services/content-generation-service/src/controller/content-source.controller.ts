import { Controller, Get, Post, Patch, Del, Body, Param, Query, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { getTenantContext } from '@scrm/server-common';
import { ContentSourceService } from '../service/content-source.service';
import { ContentComposeService } from '../service/content-compose.service';
import {
  CreateContentSourceDto,
  ListContentSourceQueryDto,
  UpdateContentSourceDto,
} from '../dto/content-source.dto';
import { ComposeContentSourceDto } from '../dto/compose.dto';

@Controller('/api/v1/content-studio/sources')
export class ContentSourceController {
  @Inject()
  ctx!: Context;

  @Inject()
  contentSourceService!: ContentSourceService;

  @Inject()
  contentComposeService!: ContentComposeService;

  @Post('/')
  @Validate()
  async create(@Body() dto: CreateContentSourceDto) {
    const { corpId, userId } = getTenantContext(this.ctx);
    const source = await this.contentSourceService.createSource(
      corpId,
      userId,
      dto
    );
    return { success: true, data: source };
  }

  @Get('/')
  @Validate()
  async list(@Query() query: ListContentSourceQueryDto) {
    const { corpId } = getTenantContext(this.ctx);
    const result = await this.contentSourceService.listSources(corpId, query);
    return { success: true, data: result };
  }

  @Get('/:id')
  async get(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);
    const source = await this.contentSourceService.getSource(corpId, Number(id));
    return { success: true, data: source };
  }

  @Patch('/:id')
  @Validate()
  async update(@Param('id') id: string, @Body() dto: UpdateContentSourceDto) {
    const { corpId } = getTenantContext(this.ctx);
    const source = await this.contentSourceService.updateSource(
      corpId,
      Number(id),
      dto
    );
    return { success: true, data: source };
  }

  @Post('/:id/compose')
  @Validate()
  async compose(@Param('id') id: string, @Body() dto: ComposeContentSourceDto) {
    const { corpId } = getTenantContext(this.ctx);
    try {
      const result = await this.contentComposeService.compose(
        corpId,
        Number(id),
        dto
      );
      return { success: true, data: result };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Compose failed';
      if (message.startsWith('KB_UNAVAILABLE')) {
        this.ctx.status = 503;
        return { success: false, error: 'KB_UNAVAILABLE', message };
      }
      if (message.startsWith('KB_READ_FAILED')) {
        this.ctx.status = 502;
        return { success: false, error: 'KB_READ_FAILED', message };
      }
      this.ctx.status = 400;
      return { success: false, error: 'COMPOSE_FAILED', message };
    }
  }

  @Del('/:id')
  async remove(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);
    await this.contentSourceService.deleteSource(corpId, Number(id));
    return { success: true, message: 'Content source deleted' };
  }
}
