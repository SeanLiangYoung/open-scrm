import { Provide, Inject, Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { HttpService } from '@midwayjs/axios';
import { ChannelCodeEntity } from '../entity/channel-code.entity';
import { CreateChannelCodeDto, QueryChannelCodeDto } from '../dto/channel-code.dto';
import * as QRCode from 'qrcode';

@Provide()
export class ChannelCodeService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(ChannelCodeEntity)
  codeRepository!: Repository<ChannelCodeEntity>;

  @Inject()
  httpService!: HttpService;

  @Config('acquisition.services')
  servicesConfig: any;

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

