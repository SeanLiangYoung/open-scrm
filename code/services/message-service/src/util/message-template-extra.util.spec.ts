import { describe, it, expect } from 'vitest';
import { validateMessageTemplateExtra } from './message-template-extra.util';

describe('validateMessageTemplateExtra', () => {
  it('undefined / null 通过', () => {
    expect(validateMessageTemplateExtra(undefined)).toEqual({ ok: true });
    expect(validateMessageTemplateExtra(null)).toEqual({ ok: true });
  });

  it('非 object 拒绝', () => {
    expect(validateMessageTemplateExtra('x')).toMatchObject({ ok: false });
    expect(validateMessageTemplateExtra([])).toMatchObject({ ok: false });
  });

  it('customerLocale 非法 BCP47 形状拒绝', () => {
    expect(validateMessageTemplateExtra({ customerLocale: '' })).toMatchObject({ ok: false });
    expect(validateMessageTemplateExtra({ customerLocale: '!!!' })).toMatchObject({ ok: false });
  });

  it('合法 customerLocale 通过', () => {
    expect(validateMessageTemplateExtra({ customerLocale: 'th-TH' })).toEqual({ ok: true });
    expect(validateMessageTemplateExtra({ customerLocale: 'zh-CN' })).toEqual({ ok: true });
  });

  it('supervisorSummaryZh 超长拒绝', () => {
    expect(
      validateMessageTemplateExtra({ supervisorSummaryZh: 'x'.repeat(501) })
    ).toMatchObject({ ok: false });
  });

  it('tabooPackId 含非法字符拒绝', () => {
    expect(validateMessageTemplateExtra({ tabooPackId: 'TH_Bangkok' })).toMatchObject({ ok: false });
  });

  it('tabooPackId 合法通过', () => {
    expect(validateMessageTemplateExtra({ tabooPackId: 'th-bangkok' })).toEqual({ ok: true });
  });

  it('未约定字段可并存（前向兼容）', () => {
    expect(
      validateMessageTemplateExtra({ customerLocale: 'de-DE', foo: 1 })
    ).toEqual({ ok: true });
  });
});
