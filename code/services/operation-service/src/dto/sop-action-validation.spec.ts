import { describe, expect, it } from 'vitest';
import { getSchema } from '@midwayjs/validate';
import { BatchCreateStepsDto } from './sop-step.dto';
import { CreateSopTemplateDto } from './sop-template.dto';
const base = { stepOrder: 1, stepName: '有效动作', stepType: 4, delayTime: 0, delayUnit: 'minute', actionContent: { followUserId: 7 } };
const invalid = [
 ['boolean employee', { actionContent: { followUserId: true } }],
 ['array employee', { actionContent: { followUserId: [7] } }],
 ['scientific employee', { actionContent: { followUserId: '7e0' } }],
 ['hex employee', { actionContent: { staffId: '0x7' } }],
 ['unsafe employee', { actionContent: { followUserId: '9007199254740993' } }],
 ['leadingzero employee', { actionContent: { followUserId: '07' } }],
 ['whitespace employee', { actionContent: { followUserId: ' 7 ' } }],
 ['invalid reminder', { stepType: 5, actionContent: { userIds: ['7e0'], content: '提醒' } }],
 ['empty reminder', { stepType: 5, actionContent: { userIds: [], content: '提醒' } }],
 ['blank reminder', { stepType: 5, actionContent: { userIds: [7], content: '   ' } }],
 ['invalid tags', { stepType: 2, actionContent: { tagIds: [true] } }],
 ['empty tags', { stepType: 2, actionContent: { tagIds: [] } }],
 ['negative delay', { delayTime: -1 }], ['fraction delay', { delayTime: 0.2 }],
 ['invalid unit', { delayUnit: 'year' }], ['unimplemented seconds', { delayUnit: 'second' }], ['more than365days', { delayTime: 366, delayUnit: 'day' }], ['invalid step', { stepType: 99 }],
 ['blank name', { stepName: '  ' }], ['zero order', { stepOrder: 0 }],
 ['blank message', { stepType: 1, actionContent: { messageType: 5, content: '  ' } }],
 ['array action', { actionContent: [7] }],
] as const;
describe('nested SOP persistence contracts', () => {
 for (const [label, patch] of invalid) {
  it(`batch rejects ${label}`, () => expect(getSchema(BatchCreateStepsDto).validate({ templateId: 3, steps: [{ ...base, ...patch }] }).error).toBeDefined());
  it(`inline template rejects ${label}`, () => expect(getSchema(CreateSopTemplateDto).validate({ templateName: '流程', templateType: 1, triggerType: 4, steps: [{ ...base, ...patch }] }).error).toBeDefined());
 }
 it.each([
  { followUserId: 7 }, { staffId: '7' }, JSON.stringify({ followUserId: '7', extra: { source: 'legacy' } })
 ])('keeps documented canonical/JSON legacy assignment valid: %s', actionContent => expect(getSchema(BatchCreateStepsDto).validate({ templateId: 3, steps: [{ ...base, actionContent }] }).error).toBeUndefined());
 it('keeps30day configuration valid', () => expect(getSchema(BatchCreateStepsDto).validate({ templateId: 3, steps: [{ ...base, delayTime: 30, delayUnit: 'day' }] }).error).toBeUndefined());
 it('group template rejects customer-only assignment inline', () => expect(getSchema(CreateSopTemplateDto).validate({ templateName: '群流程', templateType: 2, triggerType: 4, steps: [base] }).error).toBeDefined());
});

import { TriggerSopExecutionDto } from './sop-execution.dto';
it.each([true, ['1e0'], '0x1', ['01'], [1.5], '9007199254740993', []])('trigger refuses invalid target ID %s before validation coercion', targetIds => expect(getSchema(TriggerSopExecutionDto).validate({templateId:3,targetType:1,targetIds}).error).toBeDefined());
it('trigger normalizes documented canonical target strings without relaxing template/target types',()=>{const r=getSchema(TriggerSopExecutionDto).validate({templateId:'3',targetType:1,targetIds:['7',8]});expect(r.error).toBeUndefined();expect(r.value.targetIds).toEqual([7,8]);});
it.each([2147483648,9007199254740991])('batch/trigger reject out-of-INT32 template reference %s',templateId=>{expect(getSchema(BatchCreateStepsDto).validate({templateId,steps:[base]}).error).toBeDefined();expect(getSchema(TriggerSopExecutionDto).validate({templateId,targetType:1,targetIds:[7]}).error).toBeDefined();});
it.each(['7',true,'1e0',2147483648])('message template metadata requires numericINT32 %s',templateId=>expect(getSchema(BatchCreateStepsDto).validate({templateId:3,steps:[{...base,stepType:1,actionContent:{messageType:5,content:'Mock',templateId}}]}).error).toBeDefined());
it.each([{stepName:'a'.repeat(101)},{stepOrder:2147483648}])('nested fields reject actual database overflow %s',patch=>{expect(getSchema(BatchCreateStepsDto).validate({templateId:3,steps:[{...base,...patch}]}).error).toBeDefined();expect(getSchema(CreateSopTemplateDto).validate({templateName:'流程',templateType:1,triggerType:4,steps:[{...base,...patch}]}).error).toBeDefined();});
it('step name allows100 Unicode codepoints, not an arbitrary50emoji limit',()=>expect(getSchema(BatchCreateStepsDto).validate({templateId:3,steps:[{...base,stepName:'😀'.repeat(100)}]}).error).toBeUndefined());
it.each([2,5])('action%s refuses raw recipient arrays over100 even if duplicates',stepType=>expect(getSchema(BatchCreateStepsDto).validate({templateId:3,steps:[{...base,stepType,actionContent:stepType===2?{tagIds:Array(101).fill(7)}:{userIds:Array(101).fill(7),content:'提醒'}}]}).error).toBeDefined());
import { ControlExecutionDto } from './sop-execution.dto';
it.each(['1e0','0x1',true,[],9007199254740992])('control IDs reject malformed/unsafe bigint %s',executionIds=>expect(getSchema(ControlExecutionDto).validate({executionIds,action:'pause'}).error).toBeDefined());
it('execution/control bigint safeMAX remains supported',()=>expect(getSchema(ControlExecutionDto).validate({executionIds:Number.MAX_SAFE_INTEGER,action:'pause'}).error).toBeUndefined());
it.each([32768,-32769,1.5,'1',true])('nested actionType rejects non-SMALLINT %s',actionType=>expect(getSchema(BatchCreateStepsDto).validate({templateId:3,steps:[{...base,actionType}]}).error).toBeDefined());
it.each([-32768,0,5,32767,null])('optional actionType preserves actual SMALLINT/null metadata %s',actionType=>expect(getSchema(BatchCreateStepsDto).validate({templateId:3,steps:[{...base,actionType}]}).error).toBeUndefined());
it('templateName varchar100 bound checked in DTO while description TEXT is not arbitrarily capped',()=>{expect(getSchema(CreateSopTemplateDto).validate({templateName:'a'.repeat(101),templateType:1,triggerType:4}).error).toBeDefined();expect(getSchema(CreateSopTemplateDto).validate({templateName:'😀'.repeat(100),templateType:1,triggerType:4,description:'d'.repeat(10000)}).error).toBeUndefined();});
