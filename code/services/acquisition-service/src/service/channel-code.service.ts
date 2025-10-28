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
    // TODO: 调用 integration-service 生成企微活码
    // 临时使用普通二维码
    const url = `https://example.com/channel/${code.id}`;
    return await QRCode.toDataURL(url);
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

