import { Provide, Inject, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { CustomerEntity } from '../entity/customer.entity';
import { TagEntity } from '../entity/tag.entity';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { QueryCustomerDto } from '../dto/query-customer.dto';
import { Context } from '@midwayjs/koa';
import { getTenantContext } from '@scrm/server-common';
import { positiveId, tagIds as validateTagIds, tagTenant } from '../util/tag-integrity.util';

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
    const { corpId } = getTenantContext(this.ctx);
    if (dto.tagIds !== undefined && !Array.isArray(dto.tagIds)) {
      throw new httpError.BadRequestError('tagIds必须为数值标签数组');
    }
    const tagIds = dto.tagIds?.length ? validateTagIds(dto.tagIds) : [];

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

    await this.requireAssignableEmployee(dto.followUserId, corpId);

    if (tagIds.length > 0) {
      return this.customerRepository.manager.transaction(async manager => {
        const tags = await manager.getRepository(TagEntity).find({
          where: { id: In(tagIds), corpId }, lock: { mode: 'pessimistic_read' },
        });
        if (tags.length !== tagIds.length) {
          throw new httpError.BadRequestError('全部标签必须存在且属于本企业');
        }
        const repository = manager.getRepository(CustomerEntity);
        const customer = repository.create({ ...dto, corpId, tags });
        return repository.save(customer);
      });
    }

    const customer = this.customerRepository.create({
      ...dto,
      corpId,
    });

    return this.customerRepository.save(customer);
  }

  /**
   * 更新客户
   */
  async update(id: number, dto: UpdateCustomerDto): Promise<CustomerEntity> {
    const { corpId } = getTenantContext(this.ctx);

    const customer = await this.customerRepository.findOne({
      where: { id, corpId },
    });

    if (!customer) {
      throw new Error('客户不存在');
    }

    if (dto.followUserId !== null) {
      await this.requireAssignableEmployee(dto.followUserId, corpId);
    }
    Object.assign(customer, dto);
    return await this.customerRepository.save(customer);
  }

  private async requireAssignableEmployee(followUserId: number | undefined, corpId: number): Promise<void> {
    if (followUserId === undefined) return;
    if (!Number.isSafeInteger(followUserId) || followUserId < 1) {
      throw new httpError.BadRequestError('跟进员工必须为本企业已启用员工');
    }
    // Shared PostgreSQL user table is authoritative; do not import auth-service entities.
    const employees = await this.customerRepository.query(
      'SELECT id FROM "user" WHERE id = $1 AND corp_id = $2 AND status = 1 LIMIT 1',
      [followUserId, corpId]
    );
    if (!Array.isArray(employees) || employees.length === 0) {
      throw new httpError.BadRequestError('跟进员工必须为本企业已启用员工');
    }
  }

  /**
   * 删除客户（软删除）
   */
  async delete(id: number): Promise<void> {
    const { corpId } = getTenantContext(this.ctx);

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
   * 按企微外部联系人 ID 查询（不存在则返回 null）
   */
  async findByExternalUserid(externalUserid: string): Promise<CustomerEntity | null> {
    const { corpId } = getTenantContext(this.ctx);
    return await this.customerRepository.findOne({
      where: { corpId, externalUserid },
    });
  }

  /**
   * 获取客户详情
   */
  async findById(id: number): Promise<CustomerEntity> {
    const { corpId } = getTenantContext(this.ctx);

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
    const { corpId } = getTenantContext(this.ctx);
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
  async addTags(customerId: number, requested: number[]): Promise<void> {
    const { corpId } = tagTenant(this.ctx);
    const id = positiveId(customerId), ids = validateTagIds(requested);
    await this.customerRepository.manager.transaction(async manager => {
      const repository = manager.getRepository(CustomerEntity);
      const own = await repository.findOne({ where: { id, corpId }, lock: { mode: 'pessimistic_write' } });
      if (!own) throw new httpError.NotFoundError('客户不存在');
      const tags = await manager.getRepository(TagEntity).find({ where: { id: In(ids), corpId }, lock: { mode: 'pessimistic_read' } });
      if (tags.length !== ids.length) throw new httpError.BadRequestError('全部标签必须存在且属于本企业');
      const customer = await repository.findOne({ where: { id, corpId }, relations: ['tags'] });
      if (!customer) throw new httpError.NotFoundError('客户不存在');
      const existing = new Set((customer.tags || []).map(tag => tag.id));
      customer.tags = [...(customer.tags || []), ...tags.filter(tag => !existing.has(tag.id))];
      await repository.save(customer);
    });
  }

  /**
   * 移除客户标签
   */
  async removeTags(customerId: number, requested: number[]): Promise<void> {
    const { corpId } = tagTenant(this.ctx);
    customerId = positiveId(customerId);
    const tagIds = validateTagIds(requested);

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
    const { corpId } = getTenantContext(this.ctx);

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

