import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { AssetCategoryEntity } from '../entity/asset-category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/asset-category.dto';

@Provide()
export class AssetCategoryService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(AssetCategoryEntity)
  categoryRepository!: Repository<AssetCategoryEntity>;

  async createCategory(corpId: number, dto: CreateCategoryDto): Promise<AssetCategoryEntity> {
    const category = this.categoryRepository.create({
      corpId,
      name: dto.name,
      parentId: dto.parentId || 0,
      sort: dto.sort || 0,
    });

    return await this.categoryRepository.save(category);
  }

  async updateCategory(corpId: number, categoryId: number, dto: UpdateCategoryDto): Promise<void> {
    await this.categoryRepository.update(
      { id: categoryId, corpId },
      {
        name: dto.name,
        parentId: dto.parentId,
        sort: dto.sort,
      }
    );
  }

  async deleteCategory(corpId: number, categoryId: number): Promise<void> {
    await this.categoryRepository.delete({ id: categoryId, corpId });
  }

  async getCategoryTree(corpId: number): Promise<any[]> {
    const categories = await this.categoryRepository.find({
      where: { corpId },
      order: { sort: 'ASC' },
    });

    // 构建树形结构
    const buildTree = (parentId: number = 0): any[] => {
      return categories
        .filter(cat => cat.parentId === parentId)
        .map(cat => ({
          ...cat,
          children: buildTree(cat.id),
        }));
    };

    return buildTree();
  }

  async getCategoryList(corpId: number): Promise<AssetCategoryEntity[]> {
    return await this.categoryRepository.find({
      where: { corpId },
      order: { sort: 'ASC', createTime: 'ASC' },
    });
  }
}

