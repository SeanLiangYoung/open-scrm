/**
 * message_template.extra 可选校验（与 docs/facts/message-template-extra-locale-convention.md 对齐）。
 * 仅校验约定键；其它键允许存在。
 */

const BCP47ISH = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;
const TABOO_PACK_ID = /^[a-z0-9-]{1,64}$/;
const MAX_SUPERVISOR_ZH = 500;

export type ValidateMessageTemplateExtraResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateMessageTemplateExtra(extra: unknown): ValidateMessageTemplateExtraResult {
  if (extra === undefined || extra === null) {
    return { ok: true };
  }
  if (typeof extra !== 'object' || Array.isArray(extra)) {
    return { ok: false, message: 'extra 必须是 JSON 对象' };
  }
  const o = extra as Record<string, unknown>;

  if ('customerLocale' in o && o.customerLocale !== undefined && o.customerLocale !== null) {
    if (typeof o.customerLocale !== 'string' || !BCP47ISH.test(o.customerLocale.trim())) {
      return { ok: false, message: 'customerLocale 须为合法 BCP 47 风格标签（如 th-TH）' };
    }
  }

  if ('supervisorSummaryZh' in o && o.supervisorSummaryZh != null) {
    if (typeof o.supervisorSummaryZh !== 'string') {
      return { ok: false, message: 'supervisorSummaryZh 须为字符串' };
    }
    if (o.supervisorSummaryZh.length > MAX_SUPERVISOR_ZH) {
      return { ok: false, message: `supervisorSummaryZh 最长 ${MAX_SUPERVISOR_ZH} 字符` };
    }
  }

  if ('tabooPackId' in o && o.tabooPackId != null) {
    if (typeof o.tabooPackId !== 'string' || !TABOO_PACK_ID.test(o.tabooPackId)) {
      return {
        ok: false,
        message: 'tabooPackId 须为小写拉丁字母、数字、连字符，最长 64（与 RegionPack id 对齐）',
      };
    }
  }

  return { ok: true };
}
