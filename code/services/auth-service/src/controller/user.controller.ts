import { Controller, Get, Post, Put, Del, Body, Param, Query, Inject } from '@midwayjs/core';
import { UserService } from '../service/user.service';
import { Validate, Rule, RuleType } from '@midwayjs/validate';
import { adminUserId } from '../util/admin-user-validation';

export class CreateUserDto {
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

export class UpdateUserDto {
  @Rule(RuleType.string().optional())
  realName?: string;

  @Rule(RuleType.string().optional())
  mobile?: string;

  @Rule(RuleType.string().optional())
  email?: string;

  @Rule(RuleType.number().optional().valid(0, 1))
  status?: number;
}

export class ResetPasswordDto {
  @Rule(RuleType.string().min(8).required())
  newPassword: string;
}

export class AssignRolesDto {
  @Rule(
    RuleType.array()
      .items(RuleType.number().strict().integer().min(1).max(2_147_483_647))
      .required()
  )
  roleIds: number[];
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
    return await this.userService.listUsers(Number(page), Number(pageSize), keyword);
  }

  @Get('/:id')
  async getUser(@Param('id') id: string) {
    return await this.userService.getUserById(this.pathId(id));
  }

  @Put('/:id')
  @Validate()
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return await this.userService.updateUser(this.pathId(id), dto);
  }

  @Del('/:id')
  async deleteUser(@Param('id') id: string) {
    return await this.userService.deleteUser(this.pathId(id));
  }

  @Post('/:id/reset-password')
  @Validate({ errorStatus: 400 })
  async resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return await this.userService.resetPassword(this.pathId(id), dto.newPassword);
  }

  @Post('/:id/roles')
  @Validate({ errorStatus: 400 })
  async assignRoles(@Param('id') id: string, @Body() dto: AssignRolesDto) {
    return await this.userService.assignRoles(this.pathId(id), dto.roleIds);
  }
  private pathId(value: string): number {
    // Keep the route value a string: reflection must not coerce 2e0 into 2 first.
    if (typeof value !== 'string') return adminUserId(undefined);
    return adminUserId(value);
  }
}
