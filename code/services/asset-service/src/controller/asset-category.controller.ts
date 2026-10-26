import { categoryId } from '../util/asset-identity';
import { Controller, Post, Get, Put, Del, Param, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { AssetCategoryService } from '../service/asset-category.service';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/asset-category.dto';
import { getTenantContext } from '@scrm/server-common';

@Controller('/api/asset-category')
export class AssetCategoryController {
  @Inject()
  ctx!: Context;

  @Inject()
  assetCategoryService!: AssetCategoryService;

  @Post('/')
  @Validate()
  async createCategory(@Body() dto: CreateCategoryDto) {
    const { corpId } = getTenantContext(this.ctx);

    const category = await this.assetCategoryService.createCategory(corpId, dto);
    return {
      success: true,
      data: category,
      message: '创建成功'
    };
  }

  @Put('/:id')
  @Validate()
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    const { corpId } = getTenantContext(this.ctx);

    await this.assetCategoryService.updateCategory(corpId, categoryId(id), dto);
    return {
      success: true,
      message: '更新成功'
    };
  }

  @Del('/:id')
  async deleteCategory(@Param('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);

    await this.assetCategoryService.deleteCategory(corpId, categoryId(id));
    return {
      success: true,
      message: '删除成功'
    };
  }

  @Get('/tree')
  async getCategoryTree() {
    const { corpId } = getTenantContext(this.ctx);

    const tree = await this.assetCategoryService.getCategoryTree(corpId);
    return {
      success: true,
      data: tree
    };
  }

  @Get('/list')
  async getCategoryList() {
    const { corpId } = getTenantContext(this.ctx);

    const list = await this.assetCategoryService.getCategoryList(corpId);
    return {
      success: true,
      data: list
    };
  }
}
