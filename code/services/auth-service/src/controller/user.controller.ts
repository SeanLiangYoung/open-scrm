import { Controller, Get, Post, Put, Del, Body, Param, Query, Inject } from '@midwayjs/core';
import { UserService } from '../service/user.service';
import { Validate, Rule, RuleType } from '@midwayjs/validate';

class CreateUserDto {
  @Rule(RuleType.string().required())
  username: string;

  @Rule(RuleType.string().required().min(8))
  password: string;

  @Rule(RuleType.number().required())
  corpId: number;

  @Rule(RuleType.string().optional())
  realName?: string;

  @Rule(RuleType.string().optional())
  mobile?: string;

  @Rule(RuleType.string().optional())
  email?: string;
}

class UpdateUserDto {
  @Rule(RuleType.string().optional())
  realName?: string;

  @Rule(RuleType.string().optional())
  mobile?: string;

  @Rule(RuleType.string().optional())
  email?: string;

  @Rule(RuleType.number().optional().valid(0, 1))
  status?: number;
}

@Controller('/api/v1/users')
export class UserController {
  @Inject()
  userService: UserService;

  @Post('/')
  @Validate()
  async createUser(@Body() dto: CreateUserDto) {
    return await this.userService.createUser(dto);
  }

  @Get('/')
  async listUsers(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('keyword') keyword?: string
  ) {
    return await this.userService.listUsers(
      Number(page),
      Number(pageSize),
      keyword
    );
  }

  @Get('/:id')
  async getUser(@Param('id') id: number) {
    return await this.userService.getUserById(Number(id));
  }

  @Put('/:id')
  @Validate()
  async updateUser(@Param('id') id: number, @Body() dto: UpdateUserDto) {
    return await this.userService.updateUser(Number(id), dto);
  }

  @Del('/:id')
  async deleteUser(@Param('id') id: number) {
    return await this.userService.deleteUser(Number(id));
  }

  @Post('/:id/reset-password')
  async resetPassword(
    @Param('id') id: number,
    @Body('newPassword') newPassword: string
  ) {
    return await this.userService.resetPassword(Number(id), newPassword);
  }

  @Post('/:id/roles')
  async assignRoles(
    @Param('id') id: number,
    @Body('roleIds') roleIds: number[]
  ) {
    return await this.userService.assignRoles(Number(id), roleIds);
  }
}
