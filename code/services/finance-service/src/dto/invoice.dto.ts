import { Rule, RuleType } from '@midwayjs/validate';

export class CreateInvoiceDto {
  @Rule(RuleType.number().required())
  orderId: number;

  @Rule(RuleType.number().valid(1, 2).required())
  invoiceType: number; // 1-普通发票 2-增值税专用发票

  @Rule(RuleType.string().required())
  buyerName: string;

  @Rule(RuleType.string().required())
  buyerTaxNo: string;

  @Rule(RuleType.string().optional())
  buyerAddress?: string;

  @Rule(RuleType.string().optional())
  buyerPhone?: string;

  @Rule(RuleType.string().optional())
  buyerBank?: string;

  @Rule(RuleType.string().optional())
  buyerAccount?: string;

  @Rule(RuleType.string().optional())
  remark?: string;
}

export class QueryInvoiceDto {
  @Rule(RuleType.number().optional())
  orderId?: number;

  @Rule(RuleType.string().optional())
  invoiceNo?: string;

  @Rule(RuleType.number().optional())
  status?: number;

  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}

