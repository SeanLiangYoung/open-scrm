import { assetId as assetIdentity, categoryId } from '../util/asset-identity';
import { AssetCategoryEntity } from '../entity/asset-category.entity';
import { Provide, Inject, Config, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { OSSService } from '@midwayjs/oss';
import { AssetEntity } from '../entity/asset.entity';
import { AssetUsageEntity } from '../entity/asset-usage.entity';
import {
  CreateAssetDto,
  UpdateAssetDto,
  QueryAssetDto,
  RecordAssetUsageDto
} from '../dto/asset.dto';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';

@Provide()
export class AssetService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(AssetEntity)
  assetRepository!: Repository<AssetEntity>;

  @InjectEntityModel(AssetUsageEntity)
  usageRepository!: Repository<AssetUsageEntity>;

  @InjectEntityModel(AssetCategoryEntity)
  categoryRepository!: Repository<AssetCategoryEntity>;

  @Inject()
  ossService!: OSSService;

  @Config('asset')
  assetConfig: any;

  async uploadAsset(
    corpId: number,
    file: any,
    dto: CreateAssetDto,
    userId?: number
  ): Promise<AssetEntity> {
    if (dto.categoryId !== undefined) {
      await this.requireCategory(this.categoryRepository, corpId, dto.categoryId);
    }
    // 读取文件信息
    const fileBuffer = fs.readFileSync(file.filepath);
    const fileSize = fileBuffer.length;
    const mimeType = mime.lookup(file.filename) || file.mimeType;

    // 生成OSS路径
    const ext = path.extname(file.filename);
    const timestamp = Date.now();
    const ossPath = `${this.assetConfig.ossPrefix}/${corpId}/${dto.type}/${timestamp}${ext}`;

    // 上传到OSS
    const result = await this.ossService.put(ossPath, fileBuffer);

    // 创建素材记录
    const asset = this.assetRepository.create({
      corpId,
      name: dto.name,
      type: dto.type,
      categoryId: dto.categoryId,
      fileUrl: result.url,
      fileSize,
      mimeType,
      tags: dto.tags,
      createUserId: userId
    });

    await this.assetRepository.manager.transaction(async manager => {
      if (dto.categoryId !== undefined) {
        await this.requireCategory(
          manager.getRepository(AssetCategoryEntity),
          corpId,
          dto.categoryId,
          true
        );
      }
      await manager.getRepository(AssetEntity).save(asset);
    });

    // 清理临时文件
    fs.unlinkSync(file.filepath);

    return asset;
  }

  async updateAsset(corpId: number, assetId: number, dto: UpdateAssetDto): Promise<void> {
    assetId = assetIdentity(assetId);
    await this.assetRepository.manager.transaction(async manager => {
      const assets = manager.getRepository(AssetEntity);
      const target = await assets.findOne({
        where: { id: assetId, corpId },
        lock: { mode: 'pessimistic_write' }
      });
      if (!target) throw new httpError.NotFoundError('素材不存在');
      if (dto.categoryId !== undefined) {
        await this.requireCategory(
          manager.getRepository(AssetCategoryEntity),
          corpId,
          dto.categoryId,
          true
        );
      }
      const changes: Partial<AssetEntity> = {};
      if (dto.name !== undefined) changes.name = dto.name;
      if (dto.categoryId !== undefined) changes.categoryId = dto.categoryId;
      if (dto.tags !== undefined) changes.tags = dto.tags;
      if (Object.keys(changes).length) await assets.update({ id: assetId, corpId }, changes);
    });
  }

  async deleteAsset(corpId: number, assetId: number): Promise<void> {
    assetId = assetIdentity(assetId);
    const asset = await this.assetRepository.findOne({
      where: { id: assetId, corpId }
    });

    if (asset) {
      // 从OSS删除文件
      try {
        const urlObj = new URL(asset.fileUrl);
        const ossPath = urlObj.pathname.substring(1); // 移除开头的 /
        await this.ossService.delete(ossPath);
      } catch (error) {
        console.error('删除OSS文件失败:', error);
      }

      // 删除数据库记录
      await this.assetRepository.delete({ id: assetId, corpId });
    }
  }

  async queryAssets(corpId: number, query: QueryAssetDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const queryBuilder = this.assetRepository
      .createQueryBuilder('asset')
      .where('asset.corpId = :corpId', { corpId });

    if (query.name) {
      queryBuilder.andWhere('asset.name LIKE :name', {
        name: `%${query.name}%`
      });
    }

    if (query.type) {
      queryBuilder.andWhere('asset.type = :type', { type: query.type });
    }

    if (query.categoryId !== undefined) {
      queryBuilder.andWhere('asset.categoryId = :categoryId', {
        categoryId: query.categoryId
      });
    }

    queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('asset.createTime', 'DESC');

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async getAssetById(corpId: number, assetId: number): Promise<AssetEntity | null> {
    assetId = assetIdentity(assetId);
    return await this.assetRepository.findOne({
      where: { id: assetId, corpId }
    });
  }

  async recordUsage(corpId: number, dto: RecordAssetUsageDto, userId?: number): Promise<void> {
    const id = assetIdentity(dto.assetId);
    await this.assetRepository.manager.transaction(async manager => {
      const assets = manager.getRepository(AssetEntity);
      const asset = await assets.findOne({
        where: { corpId, id },
        lock: { mode: 'pessimistic_write' }
      });
      if (!asset) throw new httpError.NotFoundError('素材不存在');
      const usages = manager.getRepository(AssetUsageEntity);
      await usages.save(
        usages.create({
          corpId,
          assetId: id,
          useType: dto.useType,
          refId: dto.refId,
          useUserId: userId
        })
      );
      const updated = await assets.increment({ corpId, id }, 'useCount', 1);
      if (updated.affected !== 1) throw new Error('素材计数更新失败');
    });
  }

  private async requireCategory(
    repository: Repository<AssetCategoryEntity>,
    corpId: number,
    value: unknown,
    lock = false
  ): Promise<void> {
    const id = categoryId(value);
    const category = await repository.findOne({
      where: { corpId, id },
      ...(lock ? { lock: { mode: 'pessimistic_read' as const } } : {})
    });
    if (!category) throw new httpError.BadRequestError('分类不存在或不属于当前企业');
  }
}
