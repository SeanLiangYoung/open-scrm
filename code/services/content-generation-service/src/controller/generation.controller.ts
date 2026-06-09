import { Controller, Post, Get, Patch, Body, Param, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { getTenantContext } from '@scrm/server-common';
import { GenerationService } from '../service/generation.service';
import { GenerateContentDto, UpdateContentVariantDto } from '../dto/generation.dto';
import { PushDraftDto } from '../dto/push-draft.dto';
import { BatchPushDraftsDto } from '../dto/batch-push-draft.dto';

@Controller('/api/v1/content-studio')
export class GenerationController {
  @Inject()
  ctx!: Context;

  @Inject()
  generationService!: GenerationService;

  @Post('/sources/:id/generate')
  @Validate()
  async generate(@Param('id') id: string, @Body() dto: GenerateContentDto) {
    const { corpId } = getTenantContext(this.ctx);
    const result = await this.generationService.startGeneration(
      corpId,
      Number(id),
      dto
    );
    return { success: true, data: result };
  }

  @Get('/jobs/:id')
  async getJob(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);
    const result = await this.generationService.getJob(corpId, Number(id));
    return { success: true, data: result };
  }

  @Get('/variants/:id')
  async getVariant(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);
    const variant = await this.generationService.getVariant(corpId, Number(id));
    return { success: true, data: variant };
  }

  @Patch('/variants/:id')
  @Validate()
  async updateVariant(@Param('id') id: string, @Body() dto: UpdateContentVariantDto) {
    const { corpId } = getTenantContext(this.ctx);
    const variant = await this.generationService.updateVariant(
      corpId,
      Number(id),
      dto
    );
    return { success: true, data: variant };
  }

  @Post('/variants/:id/push-draft')
  @Validate()
  async pushDraft(@Param('id') id: string, @Body() dto: PushDraftDto) {
    const { corpId } = getTenantContext(this.ctx);
    const headers: Record<string, string> = {};
    if (this.ctx.headers['x-corp-id']) {
      headers['x-corp-id'] = String(this.ctx.headers['x-corp-id']);
    }
    if (this.ctx.headers['x-user-id']) {
      headers['x-user-id'] = String(this.ctx.headers['x-user-id']);
    }
    if (this.ctx.headers.authorization) {
      headers.authorization = String(this.ctx.headers.authorization);
    }

    const result = await this.generationService.pushVariantDraft(
      corpId,
      Number(id),
      dto,
      headers
    );
    return { success: true, data: result };
  }

  @Post('/sources/:id/push-drafts')
  @Validate()
  async pushDrafts(@Param('id') id: string, @Body() dto: BatchPushDraftsDto) {
    const { corpId } = getTenantContext(this.ctx);
    const headers: Record<string, string> = {};
    if (this.ctx.headers['x-corp-id']) {
      headers['x-corp-id'] = String(this.ctx.headers['x-corp-id']);
    }
    if (this.ctx.headers['x-user-id']) {
      headers['x-user-id'] = String(this.ctx.headers['x-user-id']);
    }
    if (this.ctx.headers.authorization) {
      headers.authorization = String(this.ctx.headers.authorization);
    }

    const results = await this.generationService.batchPushDrafts(
      corpId,
      Number(id),
      dto,
      headers
    );
    return { success: true, data: { results } };
  }
}
