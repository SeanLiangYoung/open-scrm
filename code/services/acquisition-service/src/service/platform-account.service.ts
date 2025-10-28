import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { PlatformAccountEntity } from '../entity/platform-account.entity';
import { CreatePlatformAccountDto, QueryPlatformAccountDto } from '../dto/platform-account.dto';

@Provide()
export class PlatformAccountService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(PlatformAccountEntity)
  accountRepository!: Repository<PlatformAccountEntity>;

  async createAccount(corpId: number, dto: CreatePlatformAccountDto): Promise<PlatformAccountEntity> {
    const account = this.accountRepository.create({
      corpId,
      ...dto,
    });
    return await this.accountRepository.save(account);
  }

  async queryAccounts(corpId: number, query: QueryPlatformAccountDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const queryBuilder = this.accountRepository
      .createQueryBuilder('account')
      .where('account.corpId = :corpId', { corpId });

    if (query.platform) {
      queryBuilder.andWhere('account.platform = :platform', {
        platform: query.platform,
      });
    }

    if (query.status !== undefined) {
      queryBuilder.andWhere('account.status = :status', {
        status: query.status,
      });
    }

    queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('account.createTime', 'DESC');

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

