import { Controller, Post, Get, Put, Del, Query, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { AssetCategoryService } from '../service/asset-category.service';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/asset-category.dto';

@Controller('/api/asset-category')
export class AssetCategoryController {
  @Inject()
  ctx!: Context;

  @Inject()
  assetCategoryService!: AssetCategoryService;

  @Post('/')
  @Validate()
  async createCategory(@Body() dto: CreateCategoryDto) {
    const corpId = 1; // TODO: 从JWT获取

    const category = await this.assetCategoryService.createCategory(corpId, dto);
    return {
      success: true,
      data: category,
      message: '创建成功',
    };
  }

  @Put('/:id')
  @Validate()
  async updateCategory(@Query('id') id: string, @Body() dto: UpdateCategoryDto) {
    const corpId = 1; // TODO: 从JWT获取

    await this.assetCategoryService.updateCategory(corpId, parseInt(id), dto);
    return {
      success: true,
      message: '更新成功',
    };
  }

  @Del('/:id')
  async deleteCategory(@Query('id') id: string) {
    const corpId = 1; // TODO: 从JWT获取

    await this.assetCategoryService.deleteCategory(corpId, parseInt(id));
    return {
      success: true,
      message: '删除成功',
    };
  }

  @Get('/tree')
  async getCategoryTree() {
    const corpId = 1; // TODO: 从JWT获取

    const tree = await this.assetCategoryService.getCategoryTree(corpId);
    return {
      success: true,
      data: tree,
    };
  }

  @Get('/list')
  async getCategoryList() {
    const corpId = 1; // TODO: 从JWT获取

    const list = await this.assetCategoryService.getCategoryList(corpId);
    return {
      success: true,
      data: list,
    };
  }
}

