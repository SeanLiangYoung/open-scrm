import { Rule, RuleType } from '@midwayjs/validate';

export class CreateAssetDto {
  @Rule(RuleType.string().required())
  name: string;

  @Rule(RuleType.number().valid(1, 2, 3).required())
  type: number; // 1-图片 2-视频 3-文件

  @Rule(RuleType.number().optional())
  categoryId?: number;

  @Rule(RuleType.array().items(RuleType.string()).optional())
  tags?: string[];
}

export class UpdateAssetDto {
  @Rule(RuleType.string().optional())
  name?: string;

  @Rule(RuleType.number().optional())
  categoryId?: number;

  @Rule(RuleType.array().items(RuleType.string()).optional())
  tags?: string[];
}

export class QueryAssetDto {
  @Rule(RuleType.string().optional())
  name?: string;

  @Rule(RuleType.number().optional())
  type?: number;

  @Rule(RuleType.number().optional())
  categoryId?: number;

  @Rule(RuleType.number().min(1).optional())
  page?: number;

  @Rule(RuleType.number().min(1).max(100).optional())
  pageSize?: number;
}

export class RecordAssetUsageDto {
  @Rule(RuleType.number().required())
  assetId: number;

  @Rule(RuleType.string().required())
  useType: string;

  @Rule(RuleType.number().optional())
  refId?: number;
}

