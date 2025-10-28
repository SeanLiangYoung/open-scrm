import { Controller, Post, Get, Put, Del, Query, Body, Inject, Files, Fields } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { AssetService } from '../service/asset.service';
import { CreateAssetDto, UpdateAssetDto, QueryAssetDto, RecordAssetUsageDto } from '../dto/asset.dto';

@Controller('/api/asset')
export class AssetController {
  @Inject()
  ctx!: Context;

  @Inject()
  assetService!: AssetService;

  @Post('/upload')
  async uploadAsset(@Files() files: any, @Fields() fields: any) {
    const corpId = 1; // TODO: 从JWT获取
    const userId = 1; // TODO: 从JWT获取

    if (!files || files.length === 0) {
      return {
        success: false,
        message: '请选择要上传的文件',
      };
    }

    const file = files[0];
    const dto: CreateAssetDto = {
      name: fields.name || file.filename,
      type: parseInt(fields.type),
      categoryId: fields.categoryId ? parseInt(fields.categoryId) : undefined,
      tags: fields.tags ? JSON.parse(fields.tags) : undefined,
    };

    try {
      const asset = await this.assetService.uploadAsset(corpId, file, dto, userId);
      return {
        success: true,
        data: asset,
        message: '上传成功',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '上传失败',
      };
    }
  }

  @Put('/:id')
  @Validate()
  async updateAsset(@Query('id') id: string, @Body() dto: UpdateAssetDto) {
    const corpId = 1; // TODO: 从JWT获取

    await this.assetService.updateAsset(corpId, parseInt(id), dto);
    return {
      success: true,
      message: '更新成功',
    };
  }

  @Del('/:id')
  async deleteAsset(@Query('id') id: string) {
    const corpId = 1; // TODO: 从JWT获取

    await this.assetService.deleteAsset(corpId, parseInt(id));
    return {
      success: true,
      message: '删除成功',
    };
  }

  @Get('/list')
  @Validate()
  async queryAssets(@Query() query: QueryAssetDto) {
    const corpId = 1; // TODO: 从JWT获取

    const result = await this.assetService.queryAssets(corpId, query);
    return {
      success: true,
      data: result,
    };
  }

  @Get('/:id')
  async getAsset(@Query('id') id: string) {
    const corpId = 1; // TODO: 从JWT获取

    const asset = await this.assetService.getAssetById(corpId, parseInt(id));
    return {
      success: true,
      data: asset,
    };
  }

  @Post('/usage')
  @Validate()
  async recordUsage(@Body() dto: RecordAssetUsageDto) {
    const corpId = 1; // TODO: 从JWT获取
    const userId = 1; // TODO: 从JWT获取

    await this.assetService.recordUsage(corpId, dto, userId);
    return {
      success: true,
      message: '记录成功',
    };
  }
}

