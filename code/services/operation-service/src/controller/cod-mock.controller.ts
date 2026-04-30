import { Controller, Get, Post, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { getTenantContext } from '@scrm/server-common';
import { UpdateCodMockStateDto } from '../dto/cod-mock.dto';
import { isCodMockState, type CodMockState } from '../util/cod-mock-state.util';

/** 租户内内存占位（进程重启丢失）；不落库、不接工单。 */
const store = new Map<string, CodMockState>();

function key(corpId: number): string {
  return `cod:${corpId}`;
}

/**
 * Sprint 9+ 占位：COD 状态 mock，供编排/频控联调。
 * 路径经网关 `/api/v1/operation/*`。
 */
@Controller('/api/v1/operation/cod-mock')
export class CodMockController {
  @Inject()
  ctx!: Context;

  @Get('/state')
  async getState() {
    const { corpId } = getTenantContext(this.ctx);
    const state = store.get(key(corpId)) ?? 'intent';
    return {
      success: true,
      data: {
        corpId,
        state,
        note: 'mock：内存占位，无工单持久化',
      },
    };
  }

  @Post('/state')
  @Validate()
  async postState(@Body() dto: UpdateCodMockStateDto) {
    const { corpId } = getTenantContext(this.ctx);
    if (!isCodMockState(dto.state)) {
      this.ctx.status = 400;
      return { success: false, message: '非法 state' };
    }
    store.set(key(corpId), dto.state);
    return {
      success: true,
      data: { corpId, state: dto.state },
      message: 'mock 状态已更新',
    };
  }
}
