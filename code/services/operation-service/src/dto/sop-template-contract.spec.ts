import { describe, expect, it } from 'vitest';
import { getSchema } from '@midwayjs/validate';
import { CreateSopTemplateDto, UpdateSopTemplateDto } from './sop-template.dto';

describe('SOP optional description contract', () => {
  it('lets an existing nullable description be explicitly cleared', () => {
    const result = getSchema(UpdateSopTemplateDto).validate({ description: null });
    expect(result.error).toBeUndefined();
    expect(result.value.description).toBeNull();
  });
  it('keeps omission valid and rejects accidental empty string writes', () => {
    expect(getSchema(UpdateSopTemplateDto).validate({ templateName: '只改名称' }).error).toBeUndefined();
    expect(getSchema(UpdateSopTemplateDto).validate({ description: '' }).error).toBeDefined();
  });
  it('allows a new template to omit description rather than submit an invalid blank', () => {
    expect(getSchema(CreateSopTemplateDto).validate({ templateName: '新流程', templateType: 1, triggerType: 4 }).error).toBeUndefined();
  });
});
