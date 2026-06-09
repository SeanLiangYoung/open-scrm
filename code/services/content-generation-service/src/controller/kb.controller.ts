import { Controller, Get, Post, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { LlmWikiKbService } from '../service/llm-wiki-kb.service';
import { KbSearchDto } from '../dto/kb.dto';
import { toCitationRecords } from '../util/citations.util';

@Controller('/api/v1/content-studio/kb')
export class KbController {
  @Inject()
  ctx!: Context;

  @Inject()
  llmWikiKbService!: LlmWikiKbService;

  @Get('/health')
  async health() {
    try {
      const status = await this.llmWikiKbService.getHealthStatus();
      return { success: true, data: status };
    } catch (error: unknown) {
      this.ctx.status = 503;
      const message = error instanceof Error ? error.message : 'KB unavailable';
      return {
        success: false,
        error: 'KB_UNAVAILABLE',
        message,
      };
    }
  }

  @Post('/search')
  @Validate()
  async search(@Body() dto: KbSearchDto) {
    try {
      const result = await this.llmWikiKbService.search(dto);
      return {
        success: true,
        data: {
          ...result,
          citations: toCitationRecords(result.results),
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'KB search failed';
      if (message.startsWith('KB_UNAVAILABLE')) {
        this.ctx.status = 503;
        return { success: false, error: 'KB_UNAVAILABLE', message };
      }
      this.ctx.status = 502;
      return { success: false, error: 'KB_SEARCH_FAILED', message };
    }
  }
}
