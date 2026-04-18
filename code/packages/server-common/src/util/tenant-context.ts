import { Context } from '@midwayjs/koa';

const DEFAULT_CORP_ID = 1;
const DEFAULT_USER_ID = 1;

export interface TenantContext {
  corpId: number;
  userId: number;
}

/**
 * 解析当前请求的租户与操作者：优先使用网关转发的 x-corp-id / x-user-id，
 * 否则回退到 ctx.state.user（若服务侧单独校验 JWT），最后为开发环境默认值。
 */
export function getTenantContext(ctx: Context): TenantContext {
  const hc = ctx.get('x-corp-id');
  const hu = ctx.get('x-user-id');
  if (hc !== undefined && hc !== '') {
    const corpId = parseInt(hc, 10);
    const userId =
      hu !== undefined && hu !== '' ? parseInt(hu, 10) : DEFAULT_USER_ID;
    return {
      corpId: Number.isFinite(corpId) ? corpId : DEFAULT_CORP_ID,
      userId: Number.isFinite(userId) ? userId : DEFAULT_USER_ID,
    };
  }

  const u = ctx.state?.user as { corpId?: number; userId?: number } | undefined;
  if (u?.corpId != null) {
    return {
      corpId: u.corpId,
      userId:
        u.userId != null && Number.isFinite(u.userId)
          ? u.userId
          : DEFAULT_USER_ID,
    };
  }

  return { corpId: DEFAULT_CORP_ID, userId: DEFAULT_USER_ID };
}
