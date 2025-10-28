import { Controller, Get, Post, Put, Del, Inject, Query, Body, Param } from '@midwayjs/core';
import { Validate } from '@midwayjs/validate';
import { CustomerService } from '../service/customer.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { QueryCustomerDto } from '../dto/query-customer.dto';

@Controller('/api/v1/customers')
export class CustomerController {
  @Inject()
  customerService!: CustomerService;

  /**
   * 创建客户
   */
  @Post('/')
  @Validate()
  async create(@Body() dto: CreateCustomerDto) {
    const customer = await this.customerService.create(dto);
    return {
      code: 200,
      message: '创建成功',
      data: customer,
    };
  }

  /**
   * 更新客户
   */
  @Put('/:id')
  @Validate()
  async update(@Param('id') id: number, @Body() dto: UpdateCustomerDto) {
    const customer = await this.customerService.update(id, dto);
    return {
      code: 200,
      message: '更新成功',
      data: customer,
    };
  }

  /**
   * 删除客户
   */
  @Del('/:id')
  async delete(@Param('id') id: number) {
    await this.customerService.delete(id);
    return {
      code: 200,
      message: '删除成功',
    };
  }

  /**
   * 获取客户详情
   */
  @Get('/:id')
  async getById(@Param('id') id: number) {
    const customer = await this.customerService.findById(id);
    return {
      code: 200,
      data: customer,
    };
  }

  /**
   * 查询客户列表
   */
  @Get('/')
  @Validate()
  async list(@Query() query: QueryCustomerDto) {
    const result = await this.customerService.findAll(query);
    return {
      code: 200,
      data: result,
    };
  }

  /**
   * 为客户添加标签
   */
  @Post('/:id/tags')
  async addTags(@Param('id') id: number, @Body('tagIds') tagIds: number[]) {
    await this.customerService.addTags(id, tagIds);
    return {
      code: 200,
      message: '添加标签成功',
    };
  }

  /**
   * 移除客户标签
   */
  @Del('/:id/tags/:tagId')
  async removeTag(@Param('id') id: number, @Param('tagId') tagId: number) {
    await this.customerService.removeTags(id, [tagId]);
    return {
      code: 200,
      message: '移除标签成功',
    };
  }

  /**
   * 获取客户统计
   */
  @Get('/statistics/overview')
  async getStatistics() {
    const stats = await this.customerService.getStatistics();
    return {
      code: 200,
      data: stats,
    };
  }
}

