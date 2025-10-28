import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { CustomerEntity } from '../entity/customer.entity';
import { TagEntity } from '../entity/tag.entity';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { QueryCustomerDto } from '../dto/query-customer.dto';
import { Context } from '@midwayjs/koa';

@Provide()
export class CustomerService {
  @InjectEntityModel(CustomerEntity)
  customerRepository!: Repository<CustomerEntity>;

  @InjectEntityModel(TagEntity)
  tagRepository!: Repository<TagEntity>;

  @Inject()
  ctx!: Context;

  /**
   * 创建客户
   */
  async create(dto: CreateCustomerDto): Promise<CustomerEntity> {
    const corpId = this.ctx.state.user?.corpId || 1; // 从上下文获取企业ID

    // 检查是否已存在
    const existing = await this.customerRepository.findOne({
      where: {
        corpId,
        externalUserid: dto.externalUserid,
      },
    });

    if (existing) {
      throw new Error('客户已存在');
    }

    const customer = this.customerRepository.create({
      ...dto,
      corpId,
    });

    const saved = await this.customerRepository.save(customer);

    // 如果有标签ID，添加标签关系
    if (dto.tagIds && dto.tagIds.length > 0) {
      await this.addTags(saved.id, dto.tagIds);
    }

    return saved;
  }

  /**
   * 更新客户
   */
  async update(id: number, dto: UpdateCustomerDto): Promise<CustomerEntity> {
    const corpId = this.ctx.state.user?.corpId || 1;

    const customer = await this.customerRepository.findOne({
      where: { id, corpId },
    });

    if (!customer) {
      throw new Error('客户不存在');
    }

    Object.assign(customer, dto);
    return await this.customerRepository.save(customer);
  }

  /**
   * 删除客户（软删除）
   */
  async delete(id: number): Promise<void> {
    const corpId = this.ctx.state.user?.corpId || 1;

    const customer = await this.customerRepository.findOne({
      where: { id, corpId },
    });

    if (!customer) {
      throw new Error('客户不存在');
    }

    customer.status = 0; // 0-已删除
    await this.customerRepository.save(customer);
  }

  /**
   * 获取客户详情
   */
  async findById(id: number): Promise<CustomerEntity> {
    const corpId = this.ctx.state.user?.corpId || 1;

    const customer = await this.customerRepository.findOne({
      where: { id, corpId },
      relations: ['tags'],
    });

    if (!customer) {
      throw new Error('客户不存在');
    }

    return customer;
  }

  /**
   * 查询客户列表
   */
  async findAll(dto: QueryCustomerDto) {
    const corpId = this.ctx.state.user?.corpId || 1;
    const { page = 1, pageSize = 20, keyword, status, type, followUserId, channel, tagIds, startTime, endTime } = dto;

    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.tags', 'tag')
      .where('customer.corpId = :corpId', { corpId });

    // 关键词搜索
    if (keyword) {
      queryBuilder.andWhere('(customer.name LIKE :keyword OR customer.mobile LIKE :keyword)', {
        keyword: `%${keyword}%`,
      });
    }

    // 状态筛选
    if (status !== undefined) {
      queryBuilder.andWhere('customer.status = :status', { status });
    }

    // 类型筛选
    if (type) {
      queryBuilder.andWhere('customer.type = :type', { type });
    }

    // 跟进人筛选
    if (followUserId) {
      queryBuilder.andWhere('customer.followUserId = :followUserId', { followUserId });
    }

    // 渠道筛选
    if (channel) {
      queryBuilder.andWhere('customer.channel = :channel', { channel });
    }

    // 标签筛选
    if (tagIds && tagIds.length > 0) {
      queryBuilder.andWhere('tag.id IN (:...tagIds)', { tagIds });
    }

    // 时间范围
    if (startTime) {
      queryBuilder.andWhere('customer.createTime >= :startTime', { startTime });
    }
    if (endTime) {
      queryBuilder.andWhere('customer.createTime <= :endTime', { endTime });
    }

    // 分页
    queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('customer.createTime', 'DESC');

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 为客户添加标签
   */
  async addTags(customerId: number, tagIds: number[]): Promise<void> {
    const corpId = this.ctx.state.user?.corpId || 1;

    const customer = await this.customerRepository.findOne({
      where: { id: customerId, corpId },
      relations: ['tags'],
    });

    if (!customer) {
      throw new Error('客户不存在');
    }

    const tags = await this.tagRepository.findBy({
      id: In(tagIds),
      corpId,
    });

    if (!customer.tags) {
      customer.tags = [];
    }

    // 合并标签，去重
    const existingTagIds = customer.tags.map(t => t.id);
    const newTags = tags.filter(t => !existingTagIds.includes(t.id));
    customer.tags.push(...newTags);

    await this.customerRepository.save(customer);
  }

  /**
   * 移除客户标签
   */
  async removeTags(customerId: number, tagIds: number[]): Promise<void> {
    const corpId = this.ctx.state.user?.corpId || 1;

    const customer = await this.customerRepository.findOne({
      where: { id: customerId, corpId },
      relations: ['tags'],
    });

    if (!customer) {
      throw new Error('客户不存在');
    }

    customer.tags = customer.tags.filter(t => !tagIds.includes(t.id));
    await this.customerRepository.save(customer);
  }

  /**
   * 获取客户统计
   */
  async getStatistics() {
    const corpId = this.ctx.state.user?.corpId || 1;

    const total = await this.customerRepository.count({ where: { corpId } });
    const active = await this.customerRepository.count({ where: { corpId, status: 1 } });
    const lost = await this.customerRepository.count({ where: { corpId, status: 2 } });

    return {
      total,
      active,
      lost,
      lostRate: total > 0 ? ((lost / total) * 100).toFixed(2) + '%' : '0%',
    };
  }
}

