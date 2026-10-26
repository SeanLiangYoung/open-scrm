import { Controller, Get, Post, Put, Del, Inject, Query, Body, Param } from '@midwayjs/core';
import { Validate } from '@midwayjs/validate';
import { TagService } from '../service/tag.service';
import { CreateTagDto } from '../dto/create-tag.dto';
import { UpdateTagDto } from '../dto/update-tag.dto';
import { tagId } from '../util/tag-integrity.util';

@Controller('/api/v1/tags')
export class TagController {
  @Inject()
  tagService!: TagService;

  /**
   * 创建标签
   */
  @Post('/')
  @Validate({ errorStatus: 400 })
  async create(@Body() dto: CreateTagDto) {
    const tag = await this.tagService.create(dto);
    return {
      code: 200,
      message: '创建成功',
      data: tag,
    };
  }

  /**
   * 更新标签
   */
  @Put('/:id')
  @Validate({ errorStatus: 400 })
  async update(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    const tag = await this.tagService.update(tagId(id), dto);
    return {
      code: 200,
      message: '更新成功',
      data: tag,
    };
  }

  /**
   * 删除标签
   */
  @Del('/:id')
  async delete(@Param('id') id: string) {
    await this.tagService.delete(tagId(id));
    return {
      code: 200,
      message: '删除成功',
    };
  }

  /**
   * 获取标签详情
   */
  @Get('/:id')
  async getById(@Param('id') id: string) {
    const tag = await this.tagService.findById(tagId(id));
    return {
      code: 200,
      data: tag,
    };
  }

  /**
   * 获取标签列表
   */
  @Get('/')
  async list(@Query() query: { keyword?: string; tagType?: number; status?: number }) {
    const list = await this.tagService.findAll(query);
    return {
      code: 200,
      data: list,
    };
  }

  /**
   * 获取标签树
   */
  @Get('/tree')
  async getTree() {
    const tree = await this.tagService.getTagTree();
    return {
      code: 200,
      data: tree,
    };
  }

  /**
   * 批量创建标签
   */
  @Post('/batch')
  async batchCreate(@Body() dtos: CreateTagDto[]) {
    const tags = await this.tagService.batchCreate(dtos);
    return {
      code: 200,
      message: '批量创建成功',
      data: tags,
    };
  }
}

