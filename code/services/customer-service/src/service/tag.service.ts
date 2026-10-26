import { Provide, Inject, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Like, FindOptionsWhere, EntityManager } from 'typeorm';
import { TagEntity } from '../entity/tag.entity';
import { CreateTagDto } from '../dto/create-tag.dto';
import { UpdateTagDto } from '../dto/update-tag.dto';
import { Context } from '@midwayjs/koa';
import { tagId, tagInput, tagTenant } from '../util/tag-integrity.util';

@Provide()
export class TagService {
  @InjectEntityModel(TagEntity)
  tagRepository!: Repository<TagEntity>;
  @Inject()
  ctx!: Context;

  async create(dto: CreateTagDto): Promise<TagEntity> {
    const { corpId } = tagTenant(this.ctx);
    const input = tagInput(dto, true);
    return this.tagRepository.manager.transaction(async manager => {
      await this.lockEnterprise(manager, corpId);
      const repository = manager.getRepository(TagEntity);
      await this.requireParent(repository, corpId, input.parentId ?? 0);
      await this.requireUniqueName(repository, corpId, input.tagName!);
      return repository.save(repository.create({ ...input, corpId }));
    });
  }

  async update(rawId: number, dto: UpdateTagDto): Promise<TagEntity> {
    const { corpId } = tagTenant(this.ctx);
    const id = tagId(rawId), input = tagInput(dto, false);
    return this.tagRepository.manager.transaction(async manager => {
      await this.lockEnterprise(manager, corpId);
      const repository = manager.getRepository(TagEntity);
      const tag = await this.owned(repository, id, corpId, true);
      await this.requireParent(repository, corpId, input.parentId ?? tag.parentId ?? 0, id);
      if (input.tagName !== undefined && input.tagName !== tag.tagName) await this.requireUniqueName(repository, corpId, input.tagName);
      // Only validated editable fields; primary key and enterprise never come from input.
      Object.assign(tag, input);
      return repository.save(tag);
    });
  }

  async delete(rawId: number): Promise<void> {
    const { corpId } = tagTenant(this.ctx), id = tagId(rawId);
    await this.tagRepository.manager.transaction(async manager => {
      await this.lockEnterprise(manager, corpId);
      const repository = manager.getRepository(TagEntity);
      const tag = await this.owned(repository, id, corpId, true);
      if (await repository.findOne({ where: { corpId, parentId: id } })) throw new httpError.BadRequestError('请先移除或调整子标签后再删除父标签');
      await repository.remove(tag);
    });
  }

  async findById(rawId: number): Promise<TagEntity> {
    const { corpId } = tagTenant(this.ctx);
    return this.owned(this.tagRepository, tagId(rawId), corpId);
  }

  async findAll(params?: { keyword?: string; tagType?: number; status?: number }) {
    const { corpId } = tagTenant(this.ctx);
    const { keyword, tagType, status } = params || {};
    const where: FindOptionsWhere<TagEntity> = { corpId };
    if (keyword) where.tagName = Like(`%${keyword}%`);
    if (tagType !== undefined) where.tagType = tagType;
    if (status !== undefined) where.status = status;
    return this.tagRepository.find({ where, order: { sort: 'ASC', createTime: 'DESC' } });
  }

  async getTagTree() {
    const allTags = await this.findAll();
    type Node = TagEntity & { children: Node[] };
    const map = new Map<number, Node>(allTags.map(tag => [tag.id, { ...tag, children: [] }]));
    const tree: Node[] = [];
    for (const tag of allTags) {
      const node = map.get(tag.id)!;
      if (tag.parentId === 0) tree.push(node);
      else map.get(tag.parentId)?.children.push(node);
    }
    return tree;
  }

  async batchCreate(dtos: CreateTagDto[]): Promise<TagEntity[]> {
    const { corpId } = tagTenant(this.ctx);
    if (!Array.isArray(dtos) || dtos.length < 1 || dtos.length > 100) throw new httpError.BadRequestError('批量标签须为1至100项');
    const inputs = dtos.map(dto => tagInput(dto, true));
    if (new Set(inputs.map(input => input.tagName)).size !== inputs.length) throw new httpError.BadRequestError('批量标签名不能重复');
    return this.tagRepository.manager.transaction(async manager => {
      await this.lockEnterprise(manager, corpId);
      const repository = manager.getRepository(TagEntity);
      for (const input of inputs) {
        await this.requireParent(repository, corpId, input.parentId ?? 0);
        await this.requireUniqueName(repository, corpId, input.tagName!);
      }
      return repository.save(inputs.map(input => repository.create({ ...input, corpId })));
    });
  }

  private async lockEnterprise(manager: EntityManager, corpId: number) {
    // A row lock cannot protect the first tag in an empty enterprise.
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`open-scrm:customer-tag:${corpId}`]);
  }
  private async owned(repository: Repository<TagEntity>, id: number, corpId: number, lock = false) {
    const tag = await repository.findOne({ where: { id, corpId }, ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!tag) throw new httpError.NotFoundError('标签不存在');
    return tag;
  }
  private async requireUniqueName(repository: Repository<TagEntity>, corpId: number, tagName: string) {
    if (await repository.findOne({ where: { corpId, tagName } })) throw new httpError.BadRequestError('标签名已存在');
  }
  private async requireParent(repository: Repository<TagEntity>, corpId: number, parentId: number, ownId?: number) {
    const visited = new Set<number>(ownId === undefined ? [] : [ownId]);
    let current = parentId;
    while (current !== 0) {
      tagId(current);
      if (visited.has(current)) throw new httpError.BadRequestError('父标签不能形成自引用或循环');
      visited.add(current);
      const parent = await repository.findOne({ where: { id: current, corpId }, lock: { mode: 'pessimistic_read' } });
      if (!parent) throw new httpError.BadRequestError('父标签必须存在且属于本企业');
      current = parent.parentId ?? 0;
    }
  }
}
