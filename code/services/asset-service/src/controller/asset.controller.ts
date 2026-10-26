import { multipartUploadMetadata, cleanupUploadTemp, uploadTempPath } from '../util/asset-upload';
import { httpError } from '@midwayjs/core';
import { assetId } from '../util/asset-identity';
import {
  Controller,
  Post,
  Get,
  Put,
  Del,
  Param,
  Query,
  Body,
  Inject,
  Files,
  Fields
} from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { AssetService } from '../service/asset.service';
import { UpdateAssetDto, QueryAssetDto, RecordAssetUsageDto } from '../dto/asset.dto';
import { getTenantContext } from '@scrm/server-common';

@Controller('/api/asset')
export class AssetController {
  @Inject()
  ctx!: Context;

  @Inject()
  assetService!: AssetService;

  @Post('/upload')
  async uploadAsset(@Files() files: any, @Fields() fields: any) {
    const { corpId, userId } = getTenantContext(this.ctx);

    try {
      if (!Array.isArray(files) || files.length !== 1) {
        throw new httpError.BadRequestError('请上传一个文件');
      }
      const file = files[0];
      const dto = multipartUploadMetadata(fields, file.filename);
      const asset = await this.assetService.uploadAsset(corpId, file, dto, userId);
      return { success: true, data: asset, message: '上传成功' };
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status && status >= 400 && status < 500) throw error;
      return { success: false, message: (error as Error).message || '上传失败' };
    } finally {
      if (Array.isArray(files)) for (const file of files) cleanupUploadTemp(uploadTempPath(file));
    }
  }

  @Put('/:id')
  @Validate()
  async updateAsset(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    const { corpId } = getTenantContext(this.ctx);

    await this.assetService.updateAsset(corpId, assetId(id), dto);
    return {
      success: true,
      message: '更新成功'
    };
  }

  @Del('/:id')
  async deleteAsset(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);

    await this.assetService.deleteAsset(corpId, assetId(id));
    return {
      success: true,
      message: '删除成功'
    };
  }

  @Get('/list')
  @Validate()
  async queryAssets(@Query() query: QueryAssetDto) {
    const { corpId } = getTenantContext(this.ctx);

    const result = await this.assetService.queryAssets(corpId, query);
    return {
      success: true,
      data: result
    };
  }

  @Get('/:id')
  async getAsset(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);

    const asset = await this.assetService.getAssetById(corpId, assetId(id));
    return {
      success: true,
      data: asset
    };
  }

  @Post('/usage')
  @Validate()
  async recordUsage(@Body() dto: RecordAssetUsageDto) {
    const { corpId, userId } = getTenantContext(this.ctx);

    await this.assetService.recordUsage(corpId, dto, userId);
    return {
      success: true,
      message: '记录成功'
    };
  }
}
