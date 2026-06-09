import { Controller, Post, Get, Body, Param, Query, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { getTenantContext } from '@scrm/server-common';
import { ContentService } from '../service/content.service';
import { CreateContentDto, QueryContentDto } from '../dto/content.dto';

@Controller('/api/v1/acquisition/contents')
export class ContentController {
  @Inject()
  ctx!: Context;

  @Inject()
  contentService!: ContentService;

  @Post('/')
  @Validate()
  async create(@Body() dto: CreateContentDto) {
    const { corpId, userId } = getTenantContext(this.ctx);
    const content = await this.contentService.createDraft(corpId, userId, dto);
    return { success: true, data: content };
  }

  @Get('/')
  @Validate()
  async list(@Query() query: QueryContentDto) {
    const { corpId } = getTenantContext(this.ctx);
    const result = await this.contentService.listContents(corpId, query);
    return { success: true, data: result };
  }

  @Get('/:id')
  async get(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);
    const content = await this.contentService.getContent(corpId, Number(id));
    return { success: true, data: content };
  }
}
