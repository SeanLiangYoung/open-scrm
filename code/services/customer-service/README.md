# 客户管理服务 (Customer Service)

> 基于Midway.js的客户管理微服务

---

## 📋 项目概览

客户管理服务是SCRM系统的核心服务之一，负责客户信息管理、标签管理、客户画像、客户关系维护等功能。与企业微信深度集成，实现客户数据的统一管理。

### 核心功能

- 👥 **客户管理**: 客户CRUD、客户列表、客户详情
- 🏷️ **标签管理**: 标签配置、自动打标、智能分组
- 👤 **客户画像**: 多维度画像、行为分析、客户洞察
- 📝 **跟进记录**: 跟进历史、沟通记录、备注管理
- 🔗 **客户关系**: 客户分配、客户继承、客户转移
- ⚠️ **风险预警**: 流失预警、删除记录、拉黑名单
- 💼 **客户群管理**: 群列表、群成员、群标签
- 📊 **数据统计**: 客户统计、增长分析、活跃度分析

---

## 🛠️ 技术栈

- **框架**: Midway.js 3.x
- **语言**: TypeScript 5.x
- **ORM**: TypeORM 0.3.x
- **数据库**: MySQL 8.0
- **缓存**: Redis 7.0
- **消息队列**: RabbitMQ 3.x
- **企微SDK**: @wecom/jssdk

---

## 📁 项目结构

```
customer-service/
├── src/
│   ├── controller/             # 控制器
│   │   ├── CustomerController.ts
│   │   ├── TagController.ts
│   │   └── GroupController.ts
│   │
│   ├── service/                # 服务层
│   │   ├── CustomerService.ts
│   │   ├── TagService.ts
│   │   ├── CustomerCacheService.ts
│   │   └── WeworkService.ts
│   │
│   ├── entity/                 # 实体
│   │   ├── CustomerEntity.ts
│   │   ├── TagEntity.ts
│   │   ├── CustomerTagRelationEntity.ts
│   │   └── CustomerGroupEntity.ts
│   │
│   ├── dto/                    # 数据传输对象
│   │   ├── CreateCustomerDto.ts
│   │   ├── UpdateCustomerDto.ts
│   │   ├── CustomerQueryDto.ts
│   │   └── AddTagDto.ts
│   │
│   ├── vo/                     # 视图对象
│   │   ├── CustomerVo.ts
│   │   └── CustomerDetailVo.ts
│   │
│   ├── consumer/               # 消息消费者
│   │   ├── CustomerEventConsumer.ts
│   │   └── SopEventConsumer.ts
│   │
│   ├── producer/               # 消息生产者
│   │   └── CustomerEventProducer.ts
│   │
│   ├── client/                 # RPC/HTTP客户端
│   │   ├── AuthServiceClient.ts
│   │   └── OperationServiceClient.ts
│   │
│   ├── task/                   # 定时任务
│   │   └── CustomerStatsTask.ts
│   │
│   ├── utils/                  # 工具
│   │   └── WeworkUtil.ts
│   │
│   ├── config/
│   ├── Configuration.ts
│   └── Bootstrap.ts
│
└── package.json
```

---

## 🚀 快速开始

```bash
pnpm install
pnpm dev
```

---

## 📝 核心功能实现

### 1. 客户实体

```typescript
// entity/CustomerEntity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { TagEntity } from './TagEntity';

@Entity('customer')
export class CustomerEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'corp_id' })
  corpId: number;

  @Column({ name: 'external_userid', unique: true })
  externalUserid: string; // 企微外部联系人ID

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ default: 1 })
  type: number; // 1-微信 2-企微

  @Column({ nullable: true })
  gender: number; // 0-未知 1-男 2-女

  @Column({ nullable: true })
  unionid: string;

  @Column({ nullable: true })
  province: string;

  @Column({ nullable: true })
  city: string;

  @Column({ name: 'follow_user_id', nullable: true })
  followUserId: number; // 跟进员工ID

  @Column({ name: 'add_time', nullable: true })
  addTime: Date; // 添加时间

  @Column({ nullable: true })
  channel: string; // 添加渠道

  @Column({ default: 1 })
  status: number; // 0-已删除 1-正常 2-流失

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @ManyToMany(() => TagEntity)
  @JoinTable({
    name: 'customer_tag_relation',
    joinColumn: { name: 'customer_id' },
    inverseJoinColumn: { name: 'tag_id' }
  })
  tags: TagEntity[];
}
```

### 2. 客户服务

```typescript
// service/CustomerService.ts
import { Inject, Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Like } from 'typeorm';
import { CustomerEntity } from '../entity/CustomerEntity';
import { TagEntity } from '../entity/TagEntity';
import { CustomerCacheService } from './CustomerCacheService';
import { CustomerEventProducer } from '../producer/CustomerEventProducer';
import { CreateCustomerDto } from '../dto/CreateCustomerDto';
import { CustomerQueryDto } from '../dto/CustomerQueryDto';

@Provide()
export class CustomerService {
  @InjectEntityModel(CustomerEntity)
  customerRepo: Repository<CustomerEntity>;

  @InjectEntityModel(TagEntity)
  tagRepo: Repository<TagEntity>;

  @Inject()
  customerCacheService: CustomerCacheService;

  @Inject()
  customerEventProducer: CustomerEventProducer;

  /**
   * 创建客户
   */
  async createCustomer(dto: CreateCustomerDto) {
    // 1. 创建客户
    const customer = this.customerRepo.create(dto);
    await this.customerRepo.save(customer);

    // 2. 发布客户创建事件
    await this.customerEventProducer.publishCustomerCreated(customer);

    // 3. 清除缓存
    await this.customerCacheService.deleteCustomerCache(customer.corpId);

    return customer;
  }

  /**
   * 获取客户列表
   */
  async getCustomerList(query: CustomerQueryDto) {
    const { page = 1, size = 20, keyword, channel, status, followUserId } = query;

    const qb = this.customerRepo.createQueryBuilder('customer')
      .leftJoinAndSelect('customer.tags', 'tag');

    // 关键词搜索
    if (keyword) {
      qb.where('customer.name LIKE :keyword OR customer.mobile LIKE :keyword', {
        keyword: `%${keyword}%`
      });
    }

    // 渠道筛选
    if (channel) {
      qb.andWhere('customer.channel = :channel', { channel });
    }

    // 状态筛选
    if (status !== undefined) {
      qb.andWhere('customer.status = :status', { status });
    }

    // 跟进人筛选
    if (followUserId) {
      qb.andWhere('customer.followUserId = :followUserId', { followUserId });
    }

    // 分页
    qb.skip((page - 1) * size).take(size);

    const [list, total] = await qb.getManyAndCount();

    return {
      list,
      total,
      page,
      size
    };
  }

  /**
   * 获取客户详情
   */
  async getCustomerDetail(id: number) {
    // 1. 尝试从缓存获取
    const cached = await this.customerCacheService.getCustomerCache(id);
    if (cached) {
      return cached;
    }

    // 2. 从数据库查询
    const customer = await this.customerRepo.findOne({
      where: { id },
      relations: ['tags']
    });

    if (!customer) {
      throw new Error('客户不存在');
    }

    // 3. 写入缓存
    await this.customerCacheService.setCustomerCache(customer);

    return customer;
  }

  /**
   * 给客户打标签
   */
  async addTags(customerId: number, tagIds: number[]) {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
      relations: ['tags']
    });

    if (!customer) {
      throw new Error('客户不存在');
    }

    // 查询标签
    const tags = await this.tagRepo.findByIds(tagIds);

    // 添加标签 (去重)
    const existingTagIds = customer.tags.map(t => t.id);
    const newTags = tags.filter(t => !existingTagIds.includes(t.id));
    
    customer.tags.push(...newTags);
    await this.customerRepo.save(customer);

    // 清除缓存
    await this.customerCacheService.deleteCustomerCache(customer.id);

    // 发布标签添加事件
    await this.customerEventProducer.publishCustomerTagAdded({
      customerId: customer.id,
      tagIds: newTags.map(t => t.id)
    });

    return customer;
  }

  /**
   * 客户跟进记录
   */
  async createFollowUpRecord(customerId: number, content: string, userId: number) {
    // 创建跟进记录逻辑
    // ...
  }
}
```

### 3. 缓存服务

```typescript
// service/CustomerCacheService.ts
import { Inject, Provide } from '@midwayjs/core';
import { RedisService } from '@midwayjs/redis';
import { CustomerEntity } from '../entity/CustomerEntity';

@Provide()
export class CustomerCacheService {
  @Inject()
  redisService: RedisService;

  private getCacheKey(id: number): string {
    return `customer:profile:${id}`;
  }

  /**
   * 获取客户缓存
   */
  async getCustomerCache(id: number): Promise<CustomerEntity | null> {
    const key = this.getCacheKey(id);
    const data = await this.redisService.get(key);
    
    if (data) {
      return JSON.parse(data);
    }
    
    return null;
  }

  /**
   * 设置客户缓存
   */
  async setCustomerCache(customer: CustomerEntity): Promise<void> {
    const key = this.getCacheKey(customer.id);
    await this.redisService.setex(
      key,
      600, // 10分钟
      JSON.stringify(customer)
    );
  }

  /**
   * 删除客户缓存
   */
  async deleteCustomerCache(id: number): Promise<void> {
    const key = this.getCacheKey(id);
    await this.redisService.del(key);
  }
}
```

### 4. 消息生产者

```typescript
// producer/CustomerEventProducer.ts
import { Inject, Provide } from '@midwayjs/core';
import { RabbitMQProducer } from '@midwayjs/rabbitmq';

@Provide()
export class CustomerEventProducer {
  @Inject()
  producer: RabbitMQProducer;

  /**
   * 发布客户创建事件
   */
  async publishCustomerCreated(customer: any) {
    await this.producer.publish('customer.created', {
      exchange: 'scrm.events',
      routingKey: 'customer.created',
      message: {
        eventId: this.generateEventId(),
        timestamp: new Date(),
        data: customer
      }
    });
  }

  /**
   * 发布客户标签添加事件
   */
  async publishCustomerTagAdded(data: any) {
    await this.producer.publish('customer.tag.added', {
      exchange: 'scrm.events',
      routingKey: 'customer.tag.added',
      message: {
        eventId: this.generateEventId(),
        timestamp: new Date(),
        data
      }
    });
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 5. 客户控制器

```typescript
// controller/CustomerController.ts
import { Controller, Post, Get, Put, Delete, Body, Query, Param, Inject } from '@midwayjs/core';
import { CustomerService } from '../service/CustomerService';
import { CreateCustomerDto } from '../dto/CreateCustomerDto';
import { CustomerQueryDto } from '../dto/CustomerQueryDto';
import { Validate } from '@midwayjs/validate';

@Controller('/api/v1/customers')
export class CustomerController {
  @Inject()
  customerService: CustomerService;

  @Post('/')
  @Validate()
  async createCustomer(@Body() dto: CreateCustomerDto) {
    return await this.customerService.createCustomer(dto);
  }

  @Get('/')
  async getCustomerList(@Query() query: CustomerQueryDto) {
    return await this.customerService.getCustomerList(query);
  }

  @Get('/:id')
  async getCustomerDetail(@Param('id') id: number) {
    return await this.customerService.getCustomerDetail(id);
  }

  @Post('/:id/tags')
  async addTags(
    @Param('id') id: number,
    @Body('tagIds') tagIds: number[]
  ) {
    return await this.customerService.addTags(id, tagIds);
  }
}
```

---

## 📊 数据库表设计

### 客户表

```sql
CREATE TABLE `customer` (
  `id` BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `corp_id` BIGINT UNSIGNED NOT NULL,
  `external_userid` VARCHAR(100) NOT NULL,
  `name` VARCHAR(100),
  `avatar` VARCHAR(255),
  `type` TINYINT DEFAULT 1,
  `gender` TINYINT,
  `unionid` VARCHAR(100),
  `province` VARCHAR(50),
  `city` VARCHAR(50),
  `follow_user_id` BIGINT UNSIGNED,
  `add_time` DATETIME,
  `channel` VARCHAR(50),
  `status` TINYINT DEFAULT 1,
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_external_userid` (`corp_id`, `external_userid`),
  KEY `idx_follow_user` (`follow_user_id`),
  KEY `idx_channel` (`channel`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 📞 联系方式

- 负责人: [待填写]
- 开发: [待填写]

---

**端口**: 7002  
**最后更新**: 2025-10-28

