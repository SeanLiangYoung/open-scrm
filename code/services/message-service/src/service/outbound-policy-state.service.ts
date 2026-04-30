import { Provide, Inject } from '@midwayjs/core';
import { RedisService } from '@midwayjs/redis';
import type { RegionPack } from '../catalog/region-packs';
import {
  evaluateOutboundSendPolicy,
  isWithinSilentLocalHours,
} from '../util/outbound-send-policy.util';
import type { OutboundPolicyResult } from '../util/outbound-send-policy.util';

/**
 * 营销发送日桶计数（Redis）；仅应在 consent 已通过且确认为营销路径时调用。
 * 静默命中时不读写 Redis。
 */
@Provide()
export class OutboundPolicyStateService {
  @Inject()
  redisService!: RedisService;

  /** 按 RegionPack 时区的日历日 YYYY-MM-DD */
  dayKeyInTimeZone(now: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }

  redisKey(corpId: number, packId: string, targetType: number, targetId: number, day: string): string {
    return `msg:policy:${corpId}:${packId}:${targetType}:${targetId}:${day}`;
  }

  /**
   * 静默 / 频控：先纯函数 + GET 计数；通过后再 INCR，若 INCR 结果超上限则 DECR 回滚。
   */
  async tryConsumeMarketingSendSlot(params: {
    corpId: number;
    pack: RegionPack;
    targetType: number;
    targetId: number;
    now?: Date;
  }): Promise<OutboundPolicyResult> {
    const now = params.now ?? new Date();
    if (
      isWithinSilentLocalHours(now, params.pack.timezone, params.pack.silentLocalHours)
    ) {
      return { allowed: false, reasonCode: 'silent_hours' };
    }

    const day = this.dayKeyInTimeZone(now, params.pack.timezone);
    const key = this.redisKey(params.corpId, params.pack.id, params.targetType, params.targetId, day);

    const countStr = await this.redisService.get(key);
    let count = 0;
    if (countStr != null && countStr !== '') {
      const n = parseInt(countStr, 10);
      count = Number.isNaN(n) ? 0 : n;
    }
    const pre = evaluateOutboundSendPolicy({
      now,
      pack: params.pack,
      localSendCountForDay: count,
    });
    if (!pre.allowed) {
      return pre;
    }

    const v = await this.redisService.incr(key);
    if (v === 1) {
      await this.redisService.expire(key, 172800);
    }
    if (v > params.pack.maxMarketingSendsPerRecipientPerDay) {
      await this.redisService.decr(key);
      return { allowed: false, reasonCode: 'frequency_cap' };
    }
    return { allowed: true };
  }
}
