import { categoryId as categoryIdentity } from '../util/asset-identity';
import { AssetEntity } from '../entity/asset.entity';
import { Provide, Inject, httpError } from '@midwayjs/core';
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
    return this.categoryRepository.manager.transaction(async manager => {
      await this.lockHierarchy(manager, corpId);
      const categories = manager.getRepository(AssetCategoryEntity);
      const parentId = dto.parentId === undefined ? 0 : this.parentIdentity(dto.parentId);
      await this.checkParent(categories, corpId, parentId);
      return categories.save(
        categories.create({ corpId, name: dto.name, parentId, sort: dto.sort ?? 0 })
      );
    });
  }

  async updateCategory(corpId: number, categoryId: number, dto: UpdateCategoryDto): Promise<void> {
    categoryId = categoryIdentity(categoryId);
    await this.categoryRepository.manager.transaction(async manager => {
      await this.lockHierarchy(manager, corpId);
      const categories = manager.getRepository(AssetCategoryEntity);
      if (
        !(await categories.findOne({
          where: { corpId, id: categoryId },
          lock: { mode: 'pessimistic_write' }
        }))
      ) {
        throw new httpError.NotFoundError('分类不存在');
      }
      const changes: Partial<AssetCategoryEntity> = {};
      if (dto.parentId !== undefined) {
        changes.parentId = this.parentIdentity(dto.parentId);
        await this.checkParent(categories, corpId, changes.parentId, categoryId);
      }
      if (dto.name !== undefined) changes.name = dto.name;
      if (dto.sort !== undefined) changes.sort = dto.sort;
      if (Object.keys(changes).length) await categories.update({ id: categoryId, corpId }, changes);
    });
  }

  async deleteCategory(corpId: number, categoryId: number): Promise<void> {
    categoryId = categoryIdentity(categoryId);
    await this.categoryRepository.manager.transaction(async manager => {
      await this.lockHierarchy(manager, corpId);
      const categories = manager.getRepository(AssetCategoryEntity);
      if (
        !(await categories.findOne({
          where: { corpId, id: categoryId },
          lock: { mode: 'pessimistic_write' }
        }))
      ) {
        throw new httpError.NotFoundError('分类不存在');
      }
      const children = await categories.count({ where: { corpId, parentId: categoryId } });
      const assets = await manager
        .getRepository(AssetEntity)
        .count({ where: { corpId, categoryId } });
      if (children || assets) throw new httpError.BadRequestError('分类仍有子分类或素材引用');
      await categories.delete({ id: categoryId, corpId });
    });
  }

  private parentIdentity(value: unknown): number {
    return value === 0 ? 0 : categoryIdentity(value);
  }

  private async lockHierarchy(
    manager: import('typeorm').EntityManager,
    corpId: number
  ): Promise<void> {
    // Serialize parent changes and deletion within this tenant, including empty roots.
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `asset-category:${corpId}`
    ]);
  }

  private async checkParent(
    categories: Repository<AssetCategoryEntity>,
    corpId: number,
    parentId: number,
    targetId?: number
  ): Promise<void> {
    const seen = new Set<number>();
    if (targetId !== undefined) seen.add(targetId);
    while (parentId !== 0) {
      if (seen.has(parentId)) throw new httpError.BadRequestError('分类不能形成循环');
      seen.add(parentId);
      const parent = await categories.findOne({ where: { corpId, id: parentId } });
      if (!parent) throw new httpError.BadRequestError('父分类不存在或不属于当前企业');
      parentId = parent.parentId === 0 ? 0 : categoryIdentity(parent.parentId);
    }
  }

  async getCategoryTree(corpId: number): Promise<any[]> {
    const categories = await this.categoryRepository.find({
      where: { corpId },
      order: { sort: 'ASC' }
    });

    // 构建树形结构
    const buildTree = (parentId: number = 0): any[] => {
      return categories
        .filter(cat => cat.parentId === parentId)
        .map(cat => ({
          ...cat,
          children: buildTree(cat.id)
        }));
    };

    return buildTree();
  }

  async getCategoryList(corpId: number): Promise<AssetCategoryEntity[]> {
    return await this.categoryRepository.find({
      where: { corpId },
      order: { sort: 'ASC', createTime: 'ASC' }
    });
  }
}
