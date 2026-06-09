import { Provide, Inject, Config } from '@midwayjs/core';
import { HttpService } from '@midwayjs/axios';
import { buildCreateContentDtoFromVariant } from '../util/push-draft.util';
import type { PushDraftDto } from '../dto/push-draft.dto';
import type { ContentVariantEntity } from '../entity/content-variant.entity';

@Provide()
export class AcquisitionClientService {
  @Inject()
  httpService!: HttpService;

  @Config('contentGeneration')
  contentGenerationConfig!: {
    acquisitionServiceUrl: string;
  };

  async pushVariantDraft(
    variant: ContentVariantEntity,
    dto: PushDraftDto,
    headers: Record<string, string>
  ) {
    const payload = buildCreateContentDtoFromVariant(variant, dto);
    const url = `${this.contentGenerationConfig.acquisitionServiceUrl.replace(/\/$/, '')}/api/v1/acquisition/contents`;

    const response = await this.httpService.post(url, payload, { headers });
    return response.data;
  }
}
