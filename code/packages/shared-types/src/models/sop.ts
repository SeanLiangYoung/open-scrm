/**
 * SOP相关类型定义
 */

import {
  SopTemplateType,
  SopTriggerType,
  SopStepType,
  SopStatus,
  SopExecutionStatus,
  DelayUnit,
  SopActionType
} from '../enums/sop.enum';

/**
 * SOP模板
 */
export interface SopTemplate {
  id: number;
  corpId: number;
  templateName: string;
  templateType: SopTemplateType;
  triggerType: SopTriggerType;
  triggerCondition?: any;
  status: SopStatus;
  steps?: SopStep[];
  createUserId?: number;
  createTime: string;
  updateTime: string;
}

/**
 * SOP步骤
 */
export interface SopStep {
  id: number;
  templateId: number;
  stepOrder: number;
  stepType: SopStepType;
  delayTime: number;
  delayUnit: DelayUnit;
  actionType: SopActionType;
  actionContent: any;
}

/**
 * SOP执行记录
 */
export interface SopExecution {
  id: number;
  corpId: number;
  templateId: number;
  customerId?: number;
  groupId?: number;
  currentStep: number;
  status: SopExecutionStatus;
  startTime: string;
  completeTime?: string;
}

/**
 * 创建SOP模板DTO
 */
export interface CreateSopTemplateDto {
  corpId: number;
  templateName: string;
  templateType: SopTemplateType;
  triggerType: SopTriggerType;
  triggerCondition?: any;
  steps: CreateSopStepDto[];
}

/**
 * 创建SOP步骤DTO
 */
export interface CreateSopStepDto {
  stepOrder: number;
  stepType: SopStepType;
  delayTime: number;
  delayUnit: DelayUnit;
  actionType: SopActionType;
  actionContent: any;
}

/**
 * 更新SOP模板DTO
 */
export interface UpdateSopTemplateDto {
  templateName?: string;
  status?: SopStatus;
  triggerCondition?: any;
  steps?: CreateSopStepDto[];
}

