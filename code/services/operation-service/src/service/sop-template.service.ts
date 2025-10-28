import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { SopTemplateEntity } from '../entity/sop-template.entity';
import { SopStepEntity } from '../entity/sop-step.entity';
import { CreateSopTemplateDto, UpdateSopTemplateDto, QuerySopTemplateDto } from '../dto/sop-template.dto';
import { BatchCreateStepsDto } from '../dto/sop-step.dto';

/**
 * SOP模板服务
 */
@Provide()
export class SopTemplateService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(SopTemplateEntity)
  templateRepository!: Repository<SopTemplateEntity>;

  @InjectEntityModel(SopStepEntity)
  stepRepository!: Repository<SopStepEntity>;

  /**
   * 创建SOP模板（含步骤）
   */
  async createTemplate(corpId: number, userId: number, dto: CreateSopTemplateDto): Promise<SopTemplateEntity> {
    // 创建模板
    const template = this.templateRepository.create({
      corpId,
      createUserId: userId,
      templateName: dto.templateName,
      templateType: dto.templateType,
      triggerType: dto.triggerType,
      triggerCondition: dto.triggerCondition,
      description: dto.description,
    });
    
    await this.templateRepository.save(template);

    // 如果有步骤，创建步骤
    if (dto.steps && dto.steps.length > 0) {
      const steps = dto.steps.map((step, index) => 
        this.stepRepository.create({
          templateId: template.id,
          stepOrder: step.stepOrder || index + 1,
          stepName: step.stepName,
          stepType: step.stepType,
          delayTime: step.delayTime || 0,
          delayUnit: step.delayUnit || 'minute',
          actionType: step.actionType,
          actionContent: step.actionContent,
        })
      );
      
      await this.stepRepository.save(steps);
    }

    return template;
  }

  /**
   * 更新SOP模板
   */
  async updateTemplate(id: number, corpId: number, dto: UpdateSopTemplateDto): Promise<SopTemplateEntity> {
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
   * 删除SOP模板
   */
  async deleteTemplate(id: number, corpId: number): Promise<void> {
    // 删除模板
    const result = await this.templateRepository.delete({ id, corpId });
    
    if (result.affected === 0) {
      throw new Error('模板不存在');
    }

    // 删除相关步骤
    await this.stepRepository.delete({ templateId: id });
  }

  /**
   * 获取模板详情（含步骤）
   */
  async getTemplate(id: number, corpId: number): Promise<any> {
    const template = await this.templateRepository.findOne({
      where: { id, corpId },
    });

    if (!template) {
      return null;
    }

    // 获取步骤
    const steps = await this.stepRepository.find({
      where: { templateId: id, status: 1 },
      order: { stepOrder: 'ASC' },
    });

    return {
      ...template,
      steps,
    };
  }

  /**
   * 查询模板列表
   */
  async queryTemplates(corpId: number, query: QuerySopTemplateDto) {
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

    if (query.triggerType !== undefined) {
      queryBuilder.andWhere('template.triggerType = :triggerType', {
        triggerType: query.triggerType,
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
   * 批量创建步骤
   */
  async batchCreateSteps(dto: BatchCreateStepsDto): Promise<SopStepEntity[]> {
    // 先删除旧步骤
    await this.stepRepository.delete({ templateId: dto.templateId });

    // 创建新步骤
    const steps = dto.steps.map(step => 
      this.stepRepository.create({
        templateId: dto.templateId,
        ...step,
      })
    );

    return await this.stepRepository.save(steps);
  }

  /**
   * 获取步骤列表
   */
  async getSteps(templateId: number): Promise<SopStepEntity[]> {
    return await this.stepRepository.find({
      where: { templateId, status: 1 },
      order: { stepOrder: 'ASC' },
    });
  }
}

