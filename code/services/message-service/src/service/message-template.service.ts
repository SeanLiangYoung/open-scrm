import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { MessageTemplateEntity } from '../entity/message-template.entity';
import { CreateMessageTemplateDto, UpdateMessageTemplateDto, QueryMessageTemplateDto } from '../dto/message-template.dto';

/**
 * 消息模板服务
 */
@Provide()
export class MessageTemplateService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(MessageTemplateEntity)
  templateRepository!: Repository<MessageTemplateEntity>;

  /**
   * 创建模板
   */
  async createTemplate(corpId: number, userId: number, dto: CreateMessageTemplateDto): Promise<MessageTemplateEntity> {
    const template = this.templateRepository.create({
      corpId,
      createUserId: userId,
      ...dto,
    });
    
    return await this.templateRepository.save(template);
  }

  /**
   * 更新模板
   */
  async updateTemplate(id: number, corpId: number, dto: UpdateMessageTemplateDto): Promise<MessageTemplateEntity> {
    const template = await this.templateRepository.findOne({
      where: { id, corpId },
    });

    if (!template) {
      throw new Error('模板不存在');
    }

    Object.assign(template, dto);
    template.updateTime = new Date();

    return await this.templateRepository.save(template);
  }

  /**
   * 删除模板
   */
  async deleteTemplate(id: number, corpId: number): Promise<void> {
    const result = await this.templateRepository.delete({ id, corpId });
    
    if (result.affected === 0) {
      throw new Error('模板不存在');
    }
  }

  /**
   * 获取模板详情
   */
  async getTemplate(id: number, corpId: number): Promise<MessageTemplateEntity | null> {
    return await this.templateRepository.findOne({
      where: { id, corpId },
    });
  }

  /**
   * 查询模板列表
   */
  async queryTemplates(corpId: number, query: QueryMessageTemplateDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const queryBuilder = this.templateRepository
      .createQueryBuilder('template')
      .where('template.corpId = :corpId', { corpId });

    if (query.templateName) {
      queryBuilder.andWhere('template.templateName LIKE :templateName', {
        templateName: `%${query.templateName}%`,
      });
    }

    if (query.templateType !== undefined) {
      queryBuilder.andWhere('template.templateType = :templateType', {
        templateType: query.templateType,
      });
    }

    if (query.messageType !== undefined) {
      queryBuilder.andWhere('template.messageType = :messageType', {
        messageType: query.messageType,
      });
    }

    if (query.status !== undefined) {
      queryBuilder.andWhere('template.status = :status', {
        status: query.status,
      });
    }

    queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('template.createTime', 'DESC');

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
   * 渲染模板内容（替换变量）
   */
  renderTemplate(template: string, variables: Record<string, string> = {}): string {
    let rendered = template;
    
    // 替换变量: {{变量名}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, value);
    }
    
    return rendered;
  }
}

