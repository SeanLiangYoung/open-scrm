# RFC：Consent Ledger 与 RegionPack（数据契约草案）

> **状态**：草案，未落库。评审通过后再写 TypeORM migration 与 API。

## 1. 目标

- **Consent Ledger**：证明「用户在何时、以何文案版本、对何目的」授权营销或可分析类处理。  
- **RegionPack**：把「**东南亚**（示例：泰国）/ **欧盟**（示例：德国）」等区域矩阵 **结构化**，供编排层选择默认模板、禁忌词、节庆日历与合规模式。

## 2. TypeScript 形状（示意）

```typescript
/** 处理目的：营销、分析、事务通知等应分拆存储 */
type ConsentPurpose = 'transactional' | 'marketing' | 'profiling' | 'ai_assist';

interface ConsentRecord {
  id: string;
  tenantId: string;
  subjectId: string; // 客户 / 联系人在本系统的主键
  purpose: ConsentPurpose;
  capturedAt: string; // ISO-8601
  policyVersion: string; // 隐私政策 / 订阅文案版本号
  channel: 'web' | 'line_oa' | 'whatsapp' | 'email' | 'other';
  locale: string; // BCP-47，如 th-TH、de-DE
  /** 最小化：是否存 IP 由法务决定；此处仅占位 */
  evidence?: Record<string, unknown>;
}

interface RegionPack {
  id: string; // 如 `th-bangkok`、`de-berlin`
  countryCode: string; // ISO 3166-1 alpha-2
  city?: string;
  defaultChannels: Array<'line_oa' | 'whatsapp' | 'messenger' | 'email'>;
  /** 节庆钩子：名称 + 大致月日规则（具体由日历服务或静态表实现） */
  holidays: Array<{ key: string; hint: string }>;
  tabooCategories: string[]; // 指向禁忌词库分区
  paymentHints: string[];
  timezone: string; // IANA
  /** strict | standard — EU 店建议 strict */
  complianceProfile: 'eu_strict' | 'standard';
}
```

## 3. 与现有模型关系（假设）

- `message_log` / 发送 API：增加可选 `regionPackId`、`consentPurpose`；**发送前**校验 `Marketable` 标志与目的匹配。  
- 租户级配置：`tenant.default_region_pack_id`、`tenant.compliance_mode`。

## 4. 非目标（本 RFC）

- 不规定具体 BSP（WABA/LINE）字段格式。  
- 不实现跨境传输的 DPA 文本（法务外部文档）。

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-28 | 初稿 |
