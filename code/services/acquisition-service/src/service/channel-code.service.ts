import { Provide, Inject, Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { HttpService } from '@midwayjs/axios';
import { ChannelScanEventEntity } from '../entity/channel-scan-event.entity';
import { ChannelCodeEntity } from '../entity/channel-code.entity';
import { ChannelScanTouchEntity } from '../entity/channel-scan-touch.entity';
import { CreateChannelCodeDto, QueryChannelCodeDto, IngestChannelScanDto } from '../dto/channel-code.dto';
import { hasAttributionFields } from '../util/channel-scan-touch-fields.util';
import * as QRCode from 'qrcode';

/** 对外 JSON：不包含企微 configId 等敏感字段 */
export type PublicChannelCode = Omit<ChannelCodeEntity, 'configId'>;

@Provide()
export class ChannelCodeService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(ChannelCodeEntity)
  codeRepository!: Repository<ChannelCodeEntity>;

  @InjectEntityModel(ChannelScanTouchEntity)
  scanTouchRepository!: Repository<ChannelScanTouchEntity>;

  @Inject()
  httpService!: HttpService;

  @Config('acquisition.services')
  servicesConfig: any;

  toPublicChannel(c: ChannelCodeEntity): PublicChannelCode {
    return {
      id: c.id,
      corpId: c.corpId,
      codeName: c.codeName,
      channel: c.channel,
      qrCodeUrl: c.qrCodeUrl,
      staffIds: c.staffIds,
      welcomeMsg: c.welcomeMsg,
      autoTagIds: c.autoTagIds,
      scanCount: c.scanCount,
      addCount: c.addCount,
      status: c.status,
      createTime: c.createTime,
      updateTime: c.updateTime,
    };
  }

  async getById(corpId: number, id: number): Promise<ChannelCodeEntity | null> {
    return this.codeRepository.findOne({ where: { id, corpId } });
  }

  /** Counter, durable 24-hour receipt and optional attribution commit together. */
  async recordScanEvent(
    corpId: number,
    id: number,
    dto: IngestChannelScanDto = {}
  ): Promise<{ scanCount: number; replayed: boolean }> {
    const result = await this.codeRepository.manager.transaction(async manager => {
      const codes = manager.getRepository(ChannelCodeEntity);
      const code = await codes.findOne({
        where: { corpId, id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!code) throw new Error('活码不存在');

      // Use database time after acquiring the row lock, including requests that waited.
      const [{ now }] = await manager.query('SELECT clock_timestamp() AS now');
      const currentTime = new Date(now);
      const events = manager.getRepository(ChannelScanEventEntity);
      const event = dto.externalEventId ? await events.findOne({
        where: { corpId, channelCodeId: id, externalEventId: dto.externalEventId },
        // Keep an expired receipt alive through TypeORM save's SELECT/UPDATE.
        // Concurrent expiry cleanup uses SKIP LOCKED and must skip this row.
        lock: { mode: 'pessimistic_write' },
      }) : null;
      if (event && event.expiresAt.getTime() > currentTime.getTime()) {
        return { scanCount: code.scanCount, replayed: true };
      }

      code.scanCount = (code.scanCount || 0) + 1;
      await codes.save(code);
      if (dto.externalEventId) {
        await events.save(events.create({
          ...(event ? { id: event.id } : {}),
          corpId,
          channelCodeId: id,
          externalEventId: dto.externalEventId,
          expiresAt: new Date(currentTime.getTime() + 86400000),
        }));
      }
      if (hasAttributionFields(dto)) {
        const touches = manager.getRepository(ChannelScanTouchEntity);
        const payload: Record<string, unknown> = {};
        if (dto.utm_source) payload.utm_source = dto.utm_source;
        if (dto.utm_medium) payload.utm_medium = dto.utm_medium;
        await touches.save(touches.create({
          corpId,
          channelCodeId: id,
          utmCampaign: dto.utm_campaign ?? null,
          creativeId: dto.creative_id ?? null,
          regionPackId: dto.region_pack_id ?? null,
          payload: Object.keys(payload).length ? payload : null,
        }));
      }
      return { scanCount: code.scanCount, replayed: false };
    });
    // Reclaim only after commit, without holding channel locks: global cleanup must
    // not lock another channel's receipt while that transaction needs ours.
    try {
      await this.codeRepository.manager.query(`DELETE FROM channel_scan_event WHERE id IN (
        SELECT id FROM channel_scan_event WHERE expires_at <= clock_timestamp()
        ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED
      )`);
    } catch (error) {
      // The business transaction already committed; a maintenance error must not
      // turn that success into a retryable failure (especially event-less scans).
      console.error('扫码去重凭据清理失败，需重试维护清理:', error);
    }
    return result;
  }

  async getLatestScanTouch(
    corpId: number,
    channelCodeId: number
  ): Promise<ChannelScanTouchEntity | null> {
    return this.scanTouchRepository.findOne({
      where: { corpId, channelCodeId },
      order: { createTime: 'DESC' },
    });
  }

  async createChannelCode(corpId: number, dto: CreateChannelCodeDto): Promise<ChannelCodeEntity> {
    // 创建渠道活码
    const code = this.codeRepository.create({
      corpId,
      codeName: dto.codeName,
      channel: dto.channel,
      staffIds: dto.staffIds,
      welcomeMsg: dto.welcomeMsg,
      autoTagIds: dto.autoTagIds,
    });

    await this.codeRepository.save(code);

    // 生成企微活码（调用integration-service）
    try {
      const qrCodeUrl = await this.generateWeworkQRCode(code);
      code.qrCodeUrl = qrCodeUrl;
      await this.codeRepository.save(code);
    } catch (error: any) {
      console.error('生成活码失败:', error);
    }

    return code;
  }

  private async generateWeworkQRCode(code: ChannelCodeEntity): Promise<string> {
    const base = this.servicesConfig.integration;
    const staff = (code.staffIds || []).map((id: number | string) => String(id));
    if (!staff.length) {
      const fallback = `https://example.com/channel/${code.id}`;
      return await QRCode.toDataURL(fallback);
    }

    try {
      const res = await this.httpService.post(
        `${base}/api/wework/contact-way`,
        {
          user: staff,
          remark: code.codeName,
          state: `ch_${code.id}_${code.channel}`,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-corp-id': String(code.corpId),
            'x-user-id': '1',
          },
        }
      );

      const data = res.data as {
        success?: boolean;
        data?: { configId?: string; qrCode?: string };
        message?: string;
      };
      if (data?.success && data.data?.qrCode) {
        if (data.data.configId) {
          code.configId = data.data.configId;
        }
        return data.data.qrCode;
      }
      throw new Error(data?.message || 'integration 未返回 qrCode');
    } catch (e: any) {
      console.error('企微活码生成失败，回退为占位二维码:', e?.message || e);
      const fallback = `https://example.com/channel/${code.id}`;
      return await QRCode.toDataURL(fallback);
    }
  }

  async queryChannelCodes(corpId: number, query: QueryChannelCodeDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const queryBuilder = this.codeRepository
      .createQueryBuilder('code')
      .where('code.corpId = :corpId', { corpId });

    if (query.codeName) {
      queryBuilder.andWhere('code.codeName LIKE :codeName', {
        codeName: `%${query.codeName}%`,
      });
    }

    if (query.channel) {
      queryBuilder.andWhere('code.channel = :channel', {
        channel: query.channel,
      });
    }

    if (query.status !== undefined) {
      queryBuilder.andWhere('code.status = :status', {
        status: query.status,
      });
    }

    queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('code.createTime', 'DESC');

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

