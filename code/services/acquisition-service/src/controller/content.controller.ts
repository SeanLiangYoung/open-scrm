import { Controller, Post, Get, Body, Param, Query, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { getTenantContext } from '@scrm/server-common';
import { ContentService } from '../service/content.service';
import { ContentPublishService } from '../service/content-publish.service';
import { CreateContentDto, QueryContentDto, BatchPublishContentDto } from '../dto/content.dto';

@Controller('/api/v1/acquisition/contents')
export class ContentController {
  @Inject()
  ctx!: Context;

  @Inject()
  contentService!: ContentService;

  @Inject()
  contentPublishService!: ContentPublishService;

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

  @Post('/:id/publish')
  async publish(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);
    const content = await this.contentPublishService.publishContent(corpId, Number(id));
    return { success: true, data: content };
  }

  @Post('/batch-publish')
  @Validate()
  async batchPublish(@Body() dto: BatchPublishContentDto) {
    const { corpId } = getTenantContext(this.ctx);
    const results = await this.contentPublishService.batchPublish(corpId, dto.contentIds);
    return { success: true, data: { results } };
  }

  @Get('/:id/publish-status')
  async publishStatus(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);
    const status = await this.contentPublishService.getPublishStatus(corpId, Number(id));
    return { success: true, data: status };
  }
}
