import { randomUUID } from 'crypto';
import { validateUploadMetadata, cleanupUploadTemp, uploadTempPath } from '../util/asset-upload';
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
    const filepath = uploadTempPath(file);
    let ossPath: string | undefined;
    let putAttempted = false;
    let callbackCompleted = false;
    try {
      validateUploadMetadata(dto);
      if (dto.categoryId !== undefined) {
        await this.requireCategory(this.categoryRepository, corpId, dto.categoryId);
      }
      if (!filepath) throw new httpError.BadRequestError('上传文件不可用');
      const kind = ({ 1: 'image', 2: 'video', 3: 'file' } as const)[dto.type as 1 | 2 | 3];
      const limit = this.assetConfig?.maxSize?.[kind];
      const allowed = this.assetConfig?.allowedTypes?.[kind];
      if (!Number.isSafeInteger(limit) || limit <= 0 || !Array.isArray(allowed)) {
        throw new Error('素材上传配置不可用');
      }
      if (fs.statSync(filepath).size > limit) {
        throw new httpError.PayloadTooLargeError('文件超过该类型大小限制');
      }
      const mimeType = mime.lookup(file.filename) || file.mimeType;
      if (!allowed.includes(mimeType)) throw new httpError.BadRequestError('文件类型不受支持');
      const fileBuffer = fs.readFileSync(filepath);
      if (fileBuffer.length > limit)
        throw new httpError.PayloadTooLargeError('文件超过该类型大小限制');
      const ext = path.extname(file.filename);
      ossPath = `${this.assetConfig.ossPrefix}/${corpId}/${dto.type}/${randomUUID()}${ext}`;
      putAttempted = true;
      const result = await this.ossService.put(ossPath, fileBuffer);
      const asset = this.assetRepository.create({
        corpId,
        name: dto.name,
        type: dto.type,
        categoryId: dto.categoryId,
        fileUrl: result.url,
        fileSize: fileBuffer.length,
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
        callbackCompleted = true;
      });
      return asset;
    } catch (error) {
      if (putAttempted && ossPath) {
        if (callbackCompleted) {
          // An errored COMMIT response may still represent a committed row.
          console.error('asset-upload-reconciliation-required', {
            corpId,
            ossPath,
            reason: 'commit-unknown'
          });
        } else {
          try {
            await this.ossService.delete(ossPath);
          } catch {
            console.error('asset-upload-reconciliation-required', {
              corpId,
              ossPath,
              reason: 'compensation-failed'
            });
          }
        }
      }
      throw error;
    } finally {
      cleanupUploadTemp(filepath);
    }
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
