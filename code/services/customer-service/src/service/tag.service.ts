import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Like } from 'typeorm';
import { TagEntity } from '../entity/tag.entity';
import { CreateTagDto } from '../dto/create-tag.dto';
import { Context } from '@midwayjs/koa';

@Provide()
export class TagService {
  @InjectEntityModel(TagEntity)
  tagRepository!: Repository<TagEntity>;

  @Inject()
  ctx!: Context;

  /**
   * 创建标签
   */
  async create(dto: CreateTagDto): Promise<TagEntity> {
    const corpId = this.ctx.state.user?.corpId || 1;

    // 检查标签名是否已存在
    const existing = await this.tagRepository.findOne({
      where: {
        corpId,
        tagName: dto.tagName,
      },
    });

    if (existing) {
      throw new Error('标签名已存在');
    }

    const tag = this.tagRepository.create({
      ...dto,
      corpId,
    });

    return await this.tagRepository.save(tag);
  }

  /**
   * 更新标签
   */
  async update(id: number, dto: Partial<CreateTagDto>): Promise<TagEntity> {
    const corpId = this.ctx.state.user?.corpId || 1;

    const tag = await this.tagRepository.findOne({
      where: { id, corpId },
    });

    if (!tag) {
      throw new Error('标签不存在');
    }

    // 如果修改了标签名，检查是否重复
    if (dto.tagName && dto.tagName !== tag.tagName) {
      const existing = await this.tagRepository.findOne({
        where: {
          corpId,
          tagName: dto.tagName,
        },
      });

      if (existing) {
        throw new Error('标签名已存在');
      }
    }

    Object.assign(tag, dto);
    return await this.tagRepository.save(tag);
  }

  /**
   * 删除标签
   */
  async delete(id: number): Promise<void> {
    const corpId = this.ctx.state.user?.corpId || 1;

    const tag = await this.tagRepository.findOne({
      where: { id, corpId },
    });

    if (!tag) {
      throw new Error('标签不存在');
    }

    await this.tagRepository.remove(tag);
  }

  /**
   * 获取标签详情
   */
  async findById(id: number): Promise<TagEntity> {
    const corpId = this.ctx.state.user?.corpId || 1;

    const tag = await this.tagRepository.findOne({
      where: { id, corpId },
    });

    if (!tag) {
      throw new Error('标签不存在');
    }

    return tag;
  }

  /**
   * 获取标签列表
   */
  async findAll(params?: { keyword?: string; tagType?: number; status?: number }) {
    const corpId = this.ctx.state.user?.corpId || 1;
    const { keyword, tagType, status } = params || {};

    const where: any = { corpId };

    if (keyword) {
      where.tagName = Like(`%${keyword}%`);
    }

    if (tagType !== undefined) {
      where.tagType = tagType;
    }

    if (status !== undefined) {
      where.status = status;
    }

    const list = await this.tagRepository.find({
      where,
      order: {
        sort: 'ASC',
        createTime: 'DESC',
      },
    });

    return list;
  }

  /**
   * 获取标签树（按父子关系）
   */
  async getTagTree() {
    const corpId = this.ctx.state.user?.corpId || 1;

    const allTags = await this.tagRepository.find({
      where: { corpId },
      order: {
        sort: 'ASC',
        createTime: 'DESC',
      },
    });

    // 构建树形结构
    const tagMap = new Map<number, any>();
    const tree: any[] = [];

    // 先创建所有节点
    allTags.forEach(tag => {
      tagMap.set(tag.id, {
        ...tag,
        children: [],
      });
    });

    // 建立父子关系
    allTags.forEach(tag => {
      const node = tagMap.get(tag.id);
      if (tag.parentId === 0) {
        tree.push(node);
      } else {
        const parent = tagMap.get(tag.parentId);
        if (parent) {
          parent.children.push(node);
        }
      }
    });

    return tree;
  }

  /**
   * 批量创建标签
   */
  async batchCreate(dtos: CreateTagDto[]): Promise<TagEntity[]> {
    const corpId = this.ctx.state.user?.corpId || 1;

    const tags = dtos.map(dto =>
      this.tagRepository.create({
        ...dto,
        corpId,
      })
    );

    return await this.tagRepository.save(tags);
  }
}
