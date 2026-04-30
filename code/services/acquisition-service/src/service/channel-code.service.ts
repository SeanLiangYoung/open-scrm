import { Provide, Inject, Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { HttpService } from '@midwayjs/axios';
import { RedisService } from '@midwayjs/redis';
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

  @Inject()
  redisService!: RedisService;

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

  /**
   * 扫码 +1；若提供 externalEventId 且 Redis 已存在键则返回 replayed=true 不再自增。
   * 可选归因字段写入 `channel_scan_touch`（失败不影响 scan_count）。
   */
  async recordScanEvent(
    corpId: number,
    id: number,
    dto: IngestChannelScanDto = {}
  ): Promise<{ scanCount: number; replayed: boolean }> {
    const externalEventId = dto.externalEventId;
    const code = await this.getById(corpId, id);
    if (!code) {
      throw new Error('活码不存在');
    }
    if (externalEventId) {
      const dedupeKey = `acq:chscan:${corpId}:${id}:${externalEventId}`;
      const existed = await this.redisService.get(dedupeKey);
      if (existed) {
        const latest = await this.getById(corpId, id);
        return { scanCount: latest?.scanCount ?? code.scanCount, replayed: true };
      }
      await this.redisService.set(dedupeKey, '1', 'EX', 86400);
    }
    code.scanCount = (code.scanCount || 0) + 1;
    await this.codeRepository.save(code);

    if (hasAttributionFields(dto)) {
      try {
        const payload: Record<string, unknown> = {};
        if (dto.utm_source) payload.utm_source = dto.utm_source;
        if (dto.utm_medium) payload.utm_medium = dto.utm_medium;
        const row = this.scanTouchRepository.create({
          corpId,
          channelCodeId: id,
          utmCampaign: dto.utm_campaign ?? null,
          creativeId: dto.creative_id ?? null,
          regionPackId: dto.region_pack_id ?? null,
          payload: Object.keys(payload).length ? payload : null,
        });
        await this.scanTouchRepository.save(row);
      } catch (e) {
        console.error('channel_scan_touch 写入失败（已计入 scan）:', e);
      }
    }

    return { scanCount: code.scanCount, replayed: false };
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

