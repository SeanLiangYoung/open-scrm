import { Controller, Post, Get, Body, Param, Query, Inject, httpError } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { MassTaskService } from '../service/mass-task.service';
import {
  CreateMassTaskDto,
  QueryMassTaskDto,
  ExecuteMassTaskDto,
} from '../dto/mass-task.dto';
import { getTenantContext } from '@scrm/server-common';

/**
 * 群发任务控制器
 */
@Controller('/api/mass-task')
export class MassTaskController {
  @Inject()
  ctx!: Context;

  @Inject()
  massTaskService!: MassTaskService;

  /**
   * 创建群发任务
   */
  @Post('/')
  @Validate()
  async createTask(@Body() dto: CreateMassTaskDto) {
    const { corpId, userId } = getTenantContext(this.ctx);

    const task = await this.massTaskService.createTask(corpId, userId, dto);
    return {
      success: true,
      data: task,
      message: '任务创建成功',
    };
  }

  /**
   * 执行任务
   */
  @Post('/execute')
  @Validate()
  async executeTask(@Body() dto: ExecuteMassTaskDto) {
    const { corpId } = getTenantContext(this.ctx);

    const result = await this.massTaskService.executeTask(dto.taskId, corpId);
    return {
      success: true,
      data: result,
      message: '任务执行完成',
    };
  }

  /**
   * 取消任务
   */
  @Post('/:id/cancel')
  async cancelTask(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);

    const taskId = Number(id);
    if (typeof id !== 'string' || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(taskId)) {
      throw new httpError.BadRequestError('taskId 必须为安全的十进制正整数');
    }
    const result = await this.massTaskService.cancelTask(taskId, corpId);
    return {
      success: true,
      data: result,
      message: '任务已取消',
    };
  }

  /**
   * 查询任务列表
   */
  @Get('/list')
  @Validate()
  async queryTasks(@Query() query: QueryMassTaskDto) {
    const { corpId } = getTenantContext(this.ctx);

    const result = await this.massTaskService.queryTasks(corpId, query);
    return {
      success: true,
      data: result,
    };
  }
}

