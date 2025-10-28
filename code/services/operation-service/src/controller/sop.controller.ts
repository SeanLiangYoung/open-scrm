import { Controller, Post, Get, Put, Del, Body, Param, Query, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { SopTemplateService } from '../service/sop-template.service';
import { SopExecutionService } from '../service/sop-execution.service';
import {
  CreateSopTemplateDto,
  UpdateSopTemplateDto,
  QuerySopTemplateDto,
} from '../dto/sop-template.dto';
import { BatchCreateStepsDto } from '../dto/sop-step.dto';
import {
  TriggerSopExecutionDto,
  QuerySopExecutionDto,
  ControlExecutionDto,
} from '../dto/sop-execution.dto';

/**
 * SOP控制器
 */
@Controller('/api/sop')
export class SopController {
  @Inject()
  ctx!: Context;

  @Inject()
  sopTemplateService!: SopTemplateService;

  @Inject()
  sopExecutionService!: SopExecutionService;

  /**
   * 创建SOP模板
   */
  @Post('/template')
  @Validate()
  async createTemplate(@Body() dto: CreateSopTemplateDto) {
    const corpId = 1; // TODO: 从JWT获取
    const userId = 1; // TODO: 从JWT获取

    const template = await this.sopTemplateService.createTemplate(corpId, userId, dto);
    return {
      success: true,
      data: template,
      message: 'SOP模板创建成功',
    };
  }

  /**
   * 更新SOP模板
   */
  @Put('/template/:id')
  @Validate()
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateSopTemplateDto) {
    const corpId = 1; // TODO: 从JWT获取

    const template = await this.sopTemplateService.updateTemplate(parseInt(id), corpId, dto);
    return {
      success: true,
      data: template,
      message: 'SOP模板更新成功',
    };
  }

  /**
   * 删除SOP模板
   */
  @Del('/template/:id')
  async deleteTemplate(@Param('id') id: string) {
    const corpId = 1; // TODO: 从JWT获取

    await this.sopTemplateService.deleteTemplate(parseInt(id), corpId);
    return {
      success: true,
      message: 'SOP模板删除成功',
    };
  }

  /**
   * 获取SOP模板详情
   */
  @Get('/template/:id')
  async getTemplate(@Param('id') id: string) {
    const corpId = 1; // TODO: 从JWT获取

    const template = await this.sopTemplateService.getTemplate(parseInt(id), corpId);
    return {
      success: true,
      data: template,
    };
  }

  /**
   * 查询SOP模板列表
   */
  @Get('/templates')
  @Validate()
  async queryTemplates(@Query() query: QuerySopTemplateDto) {
    const corpId = 1; // TODO: 从JWT获取

    const result = await this.sopTemplateService.queryTemplates(corpId, query);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 批量创建步骤
   */
  @Post('/steps/batch')
  @Validate()
  async batchCreateSteps(@Body() dto: BatchCreateStepsDto) {
    const steps = await this.sopTemplateService.batchCreateSteps(dto);
    return {
      success: true,
      data: steps,
      message: '步骤创建成功',
    };
  }

  /**
   * 获取步骤列表
   */
  @Get('/steps/:templateId')
  async getSteps(@Param('templateId') templateId: string) {
    const steps = await this.sopTemplateService.getSteps(parseInt(templateId));
    return {
      success: true,
      data: steps,
    };
  }

  /**
   * 触发SOP执行
   */
  @Post('/execute')
  @Validate()
  async triggerExecution(@Body() dto: TriggerSopExecutionDto) {
    const corpId = 1; // TODO: 从JWT获取

    const result = await this.sopExecutionService.triggerExecution(corpId, dto);
    return {
      success: true,
      data: result,
      message: 'SOP已触发执行',
    };
  }

  /**
   * 查询执行记录
   */
  @Get('/executions')
  @Validate()
  async queryExecutions(@Query() query: QuerySopExecutionDto) {
    const corpId = 1; // TODO: 从JWT获取

    const result = await this.sopExecutionService.queryExecutions(corpId, query);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 控制执行（暂停/恢复/取消）
   */
  @Post('/execution/control')
  @Validate()
  async controlExecution(@Body() dto: ControlExecutionDto) {
    const corpId = 1; // TODO: 从JWT获取

    const result = await this.sopExecutionService.controlExecution(
      corpId,
      dto.executionIds,
      dto.action
    );
    return {
      success: true,
      data: result,
      message: '操作成功',
    };
  }
}

