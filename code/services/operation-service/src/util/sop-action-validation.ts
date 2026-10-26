/** Shared persistence/execution validation; never repair an invalid identifier with Number coercion. */
export function sopPositiveId(value: unknown): number {
  if (!['number', 'string'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value))) throw new Error('SOP编号必须为规范十进制正安全整数');
  return Number(value);
}
export function sopInt32Id(value: unknown): number {
  const id = sopPositiveId(value);
  if (id > 2_147_483_647) throw new Error('SOP模板/步骤/标签编号不能超过INT32范围');
  return id;
}
export function sopIdList(value: unknown, max = Infinity): number[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) throw new Error('SOP目标编号数组不能为空');
  return [...new Set(value.map(sopPositiveId))];
}
export function sopDelayMs(time: unknown = 0, unit: unknown = 'minute'): number {
  const multipliers: Record<string, number> = { minute: 60_000, hour: 3_600_000, day: 86_400_000 };
  if (typeof time !== 'number' || !Number.isSafeInteger(time) || time < 0 ||
    typeof unit !== 'string' || !Object.prototype.hasOwnProperty.call(multipliers, unit)) {
    throw new Error('SOP延迟必须为非负整数，单位仅支持minute/hour/day');
  }
  const ms = time * multipliers[unit];
  if (!Number.isSafeInteger(ms) || ms > 365 * 86_400_000) throw new Error('SOP延迟不能超过365天');
  return ms;
}
function actionObject(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try { const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { ...parsed };
      if (Array.isArray(parsed)) throw new Error('动作不能为数组');
      return { content: raw };
    } catch (error) { if (error instanceof SyntaxError) return { content: raw }; throw error; }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('SOP动作配置必须为对象或兼容文本');
  return { ...raw };
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`SOP步骤缺少${label}`);
  return value;
}
export function validateSopAction(step: { stepType?: unknown; delayTime?: unknown; delayUnit?: unknown; actionContent?: unknown }): Record<string, unknown> {
  if (![1, 2, 3, 4, 5].includes(step.stepType as number)) throw new Error('不支持的步骤类型');
  sopDelayMs(step.delayTime ?? 0, step.delayUnit ?? 'minute');
  const action = actionObject(step.actionContent);
  switch (step.stepType) {
    case 1:
      action.content = text(action.content ?? action.text, '消息内容');
      break;
    case 2:
      action.tagIds = sopIdList(action.tagIds ?? action.tags, 100).map(sopInt32Id);
      break;
    case 3: {
      const url = action.url || action.assetUrl || action.link;
      action.content = text(action.content || (url ? `素材链接：${text(url, '素材链接')}` : ''), '素材链接或内容');
      break;
    }
    case 4:
      action.followUserId = sopPositiveId(action.followUserId ?? action.staffId);
      break;
    case 5:
      action.userIds = sopIdList(action.userIds ?? (action.userId != null ? [action.userId] : []), 100);
      action.content = text(action.content || action.text, '提醒内容');
      if (action.title !== undefined) text(action.title, '提醒标题');
      if (action.notificationType !== undefined && ![1, 2, 3].includes(action.notificationType as number)) throw new Error('提醒类型无效');
      break;
  }
  if ((step.stepType === 1 || step.stepType === 3) && action.templateId !== undefined) {
    if (typeof action.templateId !== 'number') throw new Error('消息模板引用必须为JSON正整数INT32');
    sopInt32Id(action.templateId);
  }
  if ((step.stepType === 1 || step.stepType === 3) && action.messageType !== undefined &&
    ![1, 2, 3, 4, 5].includes(action.messageType as number)) throw new Error('消息渠道无效');
  return action;
}
export function validateSavedSopStep(raw: unknown): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('步骤配置无效');
  const step = raw as Record<string, unknown>;
  if (Array.from(text(step.stepName, '步骤名称')).length > 100) throw new Error('步骤名称不能超过100字符');
  if (step.stepOrder !== undefined) sopInt32Id(step.stepOrder);
  if (step.actionType !== undefined && step.actionType !== null && (typeof step.actionType !== 'number' || !Number.isInteger(step.actionType) || step.actionType < -32768 || step.actionType > 32767)) throw new Error('actionType必须为SMALLINT整数或null');
  validateSopAction(step);
}
export function validateSavedSopSteps(raw: unknown, templateType?: number): void {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('SOP步骤不能为空');
  for (const step of raw) {
    validateSavedSopStep(step);
    if (templateType === 2 && [2, 4].includes(step.stepType)) throw new Error('群SOP不支持客户打标签或分配步骤');
  }
}

export function validateSopTemplateName(value: unknown): void {
  if (Array.from(text(value, '模板名称')).length > 100) throw new Error('模板名称不能超过100字符');
}
export function validateSopTemplateFields(value: Record<string, unknown>, creating: boolean): void {
  if (creating || value.templateName !== undefined) validateSopTemplateName(value.templateName);
  if (value.description !== undefined && !(value.description === null && !creating) && typeof value.description !== 'string') throw new Error('模板描述必须为文本');
  if ((creating || value.templateType !== undefined) && ![1, 2].includes(value.templateType as number)) throw new Error('模板类型无效');
  if ((creating || value.triggerType !== undefined) && ![1, 2, 3, 4].includes(value.triggerType as number)) throw new Error('触发类型无效');
  if (value.status !== undefined && ![0, 1].includes(value.status as number)) throw new Error('模板状态无效');
}
