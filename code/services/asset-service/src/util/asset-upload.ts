import { httpError } from '@midwayjs/core';
import { getSchema } from '@midwayjs/validate';
import * as fs from 'fs';
import { CreateAssetDto } from '../dto/asset.dto';
import { categoryId } from './asset-identity';

export function validateUploadMetadata(dto: CreateAssetDto): void {
  const { error } = getSchema(CreateAssetDto).validate(dto, {
    convert: false,
    allowUnknown: false
  });
  if (error) throw new httpError.BadRequestError('上传字段格式错误');
}

export function multipartUploadMetadata(fields: unknown, filename: string): CreateAssetDto {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw new httpError.BadRequestError('上传字段格式错误');
  }
  const raw = fields as Record<string, unknown>;
  if (
    Object.keys(raw).some(key => !['name', 'type', 'categoryId', 'tags'].includes(key)) ||
    typeof raw.type !== 'string' ||
    !/^[123]$/.test(raw.type)
  ) {
    throw new httpError.BadRequestError('上传字段格式错误');
  }
  let tags: unknown;
  if (raw.tags !== undefined) {
    if (typeof raw.tags !== 'string')
      throw new httpError.BadRequestError('标签必须为JSON字符串数组');
    try {
      tags = JSON.parse(raw.tags);
    } catch {
      throw new httpError.BadRequestError('标签必须为JSON字符串数组');
    }
  }
  const dto = {
    name: raw.name === undefined || raw.name === '' ? filename : raw.name,
    type: Number(raw.type),
    categoryId:
      raw.categoryId === undefined || raw.categoryId === ''
        ? undefined
        : categoryId(raw.categoryId),
    tags
  } as CreateAssetDto;
  validateUploadMetadata(dto);
  return dto;
}

/** Middleware owns these paths; maintenance errors must not invert a committed result. */
export function cleanupUploadTemp(filepath: unknown): void {
  if (typeof filepath !== 'string') return;
  try {
    fs.unlinkSync(filepath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('asset-upload-temp-cleanup-failed', { filepath });
    }
  }
}

/** Midway file mode uses data; filepath supports existing direct service callers. */
export function uploadTempPath(
  file: { data?: unknown; filepath?: unknown } | null | undefined
): string | undefined {
  if (typeof file?.data === 'string') return file.data;
  return typeof file?.filepath === 'string' ? file.filepath : undefined;
}
