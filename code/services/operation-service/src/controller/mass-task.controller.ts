import { Controller, Post, Get, Body, Param, Query, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { MassTaskService } from '../service/mass-task.service';
import {
  CreateMassTaskDto,
  QueryMassTaskDto,
  ExecuteMassTaskDto,
} from '../dto/mass-task.dto';

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
    const corpId = 1; // TODO: 从JWT获取
    const userId = 1; // TODO: 从JWT获取

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
    const corpId = 1; // TODO: 从JWT获取

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
    const corpId = 1; // TODO: 从JWT获取

    const result = await this.massTaskService.cancelTask(parseInt(id), corpId);
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
    const corpId = 1; // TODO: 从JWT获取

    const result = await this.massTaskService.queryTasks(corpId, query);
    return {
      success: true,
      data: result,
    };
  }
}

