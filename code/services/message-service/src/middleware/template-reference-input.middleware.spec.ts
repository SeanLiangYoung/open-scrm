import { describe,it,expect,vi } from 'vitest';
import { TemplateReferenceInputMiddleware } from './template-reference-input.middleware';
describe('template reference local input status boundary',()=>{
 it.each(['7',0,-1,1.5,null,Number.MAX_SAFE_INTEGER+1,2147483648,Number.MAX_SAFE_INTEGER])('rejects %s400 before next DTO validation',async templateId=>{const next=vi.fn();await expect(new TemplateReferenceInputMiddleware().resolve()({request:{body:{templateId}}} as any,next)).rejects.toMatchObject({status:400});expect(next).not.toHaveBeenCalled()});
 it.each([{}, {templateId:7}, {content:null}])('does not alter non-reference validation %j',async body=>{const next=vi.fn().mockResolvedValue('next');expect(await new TemplateReferenceInputMiddleware().resolve()({request:{body}} as any,next)).toBe('next');expect(next).toHaveBeenCalledTimes(1)});
});
