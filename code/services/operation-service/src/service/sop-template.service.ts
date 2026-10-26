import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { SopTemplateEntity } from '../entity/sop-template.entity';
import { SopStepEntity } from '../entity/sop-step.entity';
import { CreateSopTemplateDto, UpdateSopTemplateDto, QuerySopTemplateDto } from '../dto/sop-template.dto';
import { BatchCreateStepsDto } from '../dto/sop-step.dto';
import { sopInt32Id, validateSavedSopSteps, validateSopTemplateFields } from '../util/sop-action-validation';

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
    validateSopTemplateFields(dto as unknown as Record<string, unknown>, true);
    if (dto.steps !== undefined) validateSavedSopSteps(dto.steps, dto.templateType);
    return this.templateRepository.manager.transaction(async manager => {
      const templates = manager.getRepository(SopTemplateEntity);
      const stepsRepository = manager.getRepository(SopStepEntity);
      const template = templates.create({
        corpId, createUserId: userId, templateName: dto.templateName,
        templateType: dto.templateType, triggerType: dto.triggerType,
        triggerCondition: dto.triggerCondition, description: dto.description,
      });
      await templates.save(template);
      if (dto.steps?.length) {
        const steps = dto.steps.map((step, index) => stepsRepository.create({
          templateId: template.id, stepOrder: step.stepOrder ?? index + 1,
          stepName: step.stepName, stepType: step.stepType,
          delayTime: step.delayTime ?? 0, delayUnit: step.delayUnit ?? 'minute',
          actionType: step.actionType, actionContent: step.actionContent,
        }));
        await stepsRepository.save(steps);
      }
      return template;
    });
  }

  /**
   * 更新SOP模板
   */
  async updateTemplate(id: number, corpId: number, dto: UpdateSopTemplateDto): Promise<SopTemplateEntity> {
    sopInt32Id(id);
    validateSopTemplateFields(dto as unknown as Record<string, unknown>, false);
    const template = await this.templateRepository.findOne({
      where: { id, corpId },
    });

    if (!template) {
      throw new Error('模板不存在');
    }

    if (dto.templateType === 2 && template.templateType !== 2) {
      const existingSteps = await this.stepRepository.find({ where: { templateId: id, status: 1 } });
      if (existingSteps.length) validateSavedSopSteps(existingSteps, 2);
    }
    const editable = ['templateName', 'templateType', 'triggerType', 'triggerCondition', 'description', 'status'] as const;
    for (const key of editable) {
      if (dto[key] !== undefined) (template as any)[key] = dto[key];
    }
    template.updateTime = new Date();

    return await this.templateRepository.save(template);
  }

  /**
   * 删除SOP模板
   */
  async deleteTemplate(id: number, corpId: number): Promise<void> {
    sopInt32Id(id);
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
    sopInt32Id(id);
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
  async batchCreateSteps(dto: BatchCreateStepsDto, corpId: number): Promise<SopStepEntity[]> {
    validateSavedSopSteps(dto.steps);
    return this.stepRepository.manager.transaction(async manager => {
      const templates = manager.getRepository(SopTemplateEntity);
      const stepsRepository = manager.getRepository(SopStepEntity);
      const owned = await this.requireOwnedTemplate(dto.templateId, corpId, templates, true);
      validateSavedSopSteps(dto.steps, owned.templateType);
      // Lock the owned template for the entire replacement, including rollback.
      await stepsRepository.delete({ templateId: dto.templateId });
      const steps = dto.steps.map(step =>
        stepsRepository.create({
          templateId: dto.templateId,
          stepOrder: step.stepOrder,
          stepName: step.stepName,
          stepType: step.stepType,
          delayTime: step.delayTime ?? 0,
          delayUnit: step.delayUnit ?? 'minute',
          actionType: step.actionType,
          actionContent: step.actionContent,
        })
      );
      return stepsRepository.save(steps);
    });
  }

  /**
   * 获取步骤列表
   */
  async getSteps(templateId: number, corpId: number): Promise<SopStepEntity[]> {
    await this.requireOwnedTemplate(templateId, corpId);
    return await this.stepRepository.find({
      where: { templateId, status: 1 },
      order: { stepOrder: 'ASC' },
    });
  }
  private async requireOwnedTemplate(
    id: number,
    corpId: number,
    repository = this.templateRepository,
    lockTemplate = false
  ): Promise<SopTemplateEntity> {
    sopInt32Id(id);
    // Fail closed even for callers outside the validated HTTP controller.
    if (!Number.isSafeInteger(corpId) || corpId <= 0) throw new Error('模板不存在');
    const template = await repository.findOne({
      where: { id, corpId },
      ...(lockTemplate ? { lock: { mode: 'pessimistic_write' as const } } : {})
    });
    if (!template) throw new Error('模板不存在');
    return template;
  }

}

