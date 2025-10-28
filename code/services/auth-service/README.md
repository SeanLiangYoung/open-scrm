# 认证授权服务 (Auth Service)

> 基于Midway.js的认证授权微服务

---

## 📋 项目概览

认证授权服务负责用户认证、权限管理、JWT签发、Token刷新等核心安全功能。采用RBAC权限模型，支持多角色、多权限的灵活配置。

### 核心功能

- 🔐 **用户认证**: 登录、注册、密码加密
- 🎫 **JWT管理**: Token签发、验证、刷新
- 👥 **用户管理**: 用户信息、密码修改、账号管理
- 🛡️ **权限管理**: RBAC模型、角色管理、权限配置
- 📱 **多端登录**: PC端、移动端、小程序
- 🔄 **SSO**: 单点登录支持
- 📝 **审计日志**: 登录日志、操作记录

---

## 🛠️ 技术栈

- **框架**: Midway.js 3.x
- **语言**: TypeScript 5.x
- **ORM**: TypeORM 0.3.x
- **数据库**: MySQL 8.0
- **缓存**: Redis 7.0
- **加密**: bcrypt
- **JWT**: @midwayjs/jwt

---

## 📁 项目结构

```
auth-service/
├── src/
│   ├── controller/             # 控制器
│   │   ├── AuthController.ts   # 认证控制器
│   │   ├── UserController.ts   # 用户控制器
│   │   └── RoleController.ts   # 角色控制器
│   │
│   ├── service/                # 服务层
│   │   ├── AuthService.ts      # 认证服务
│   │   ├── UserService.ts      # 用户服务
│   │   ├── RoleService.ts      # 角色服务
│   │   └── PermissionService.ts # 权限服务
│   │
│   ├── entity/                 # 实体
│   │   ├── UserEntity.ts       # 用户实体
│   │   ├── RoleEntity.ts       # 角色实体
│   │   ├── PermissionEntity.ts # 权限实体
│   │   └── UserRoleEntity.ts   # 用户角色关联
│   │
│   ├── dto/                    # 数据传输对象
│   │   ├── LoginDto.ts         # 登录DTO
│   │   ├── RegisterDto.ts      # 注册DTO
│   │   ├── CreateUserDto.ts    # 创建用户DTO
│   │   └── UpdateUserDto.ts    # 更新用户DTO
│   │
│   ├── vo/                     # 视图对象
│   │   ├── UserVo.ts           # 用户VO
│   │   └── LoginVo.ts          # 登录响应VO
│   │
│   ├── middleware/             # 中间件
│   │   └── JwtAuthMiddleware.ts # JWT认证中间件
│   │
│   ├── guard/                  # 守卫
│   │   └── PermissionGuard.ts  # 权限守卫
│   │
│   ├── decorator/              # 装饰器
│   │   └── RequirePermission.ts # 权限装饰器
│   │
│   ├── utils/                  # 工具
│   │   ├── PasswordUtil.ts     # 密码工具
│   │   └── JwtUtil.ts          # JWT工具
│   │
│   ├── config/                 # 配置
│   │   └── config.default.ts
│   │
│   ├── Configuration.ts
│   └── Bootstrap.ts
│
└── package.json
```

---

## 🚀 快速开始

```bash
# 安装依赖
pnpm install

# 开发
pnpm dev

# 构建
pnpm build

# 启动
pnpm start
```

---

## 📝 核心功能实现

### 1. 用户实体

```typescript
// entity/UserEntity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { RoleEntity } from './RoleEntity';

@Entity('user')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'corp_id' })
  corpId: number;

  @Column({ unique: true })
  username: string;

  @Column({ select: false })
  password: string;

  @Column({ name: 'real_name', nullable: true })
  realName: string;

  @Column({ nullable: true })
  mobile: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ name: 'wework_userid', nullable: true })
  weworkUserid: string;

  @Column({ default: 1 })
  status: number; // 0-禁用 1-正常

  @Column({ name: 'is_admin', default: 0 })
  isAdmin: number;

  @Column({ name: 'last_login_time', nullable: true })
  lastLoginTime: Date;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @ManyToMany(() => RoleEntity)
  @JoinTable({
    name: 'user_role',
    joinColumn: { name: 'user_id' },
    inverseJoinColumn: { name: 'role_id' }
  })
  roles: RoleEntity[];
}
```

### 2. 认证服务

```typescript
// service/AuthService.ts
import { Inject, Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@midwayjs/jwt';
import { UserEntity } from '../entity/UserEntity';
import { PasswordUtil } from '../utils/PasswordUtil';
import { LoginDto } from '../dto/LoginDto';
import { RegisterDto } from '../dto/RegisterDto';

@Provide()
export class AuthService {
  @InjectEntityModel(UserEntity)
  userRepo: Repository<UserEntity>;

  @Inject()
  jwtService: JwtService;

  @Inject()
  passwordUtil: PasswordUtil;

  /**
   * 用户登录
   */
  async login(dto: LoginDto) {
    // 1. 查询用户
    const user = await this.userRepo.findOne({
      where: { username: dto.username },
      select: ['id', 'username', 'password', 'corpId', 'status'],
      relations: ['roles']
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.status !== 1) {
      throw new Error('账号已被禁用');
    }

    // 2. 验证密码
    const isMatch = await this.passwordUtil.verifyPassword(
      dto.password,
      user.password
    );

    if (!isMatch) {
      throw new Error('密码错误');
    }

    // 3. 生成Token
    const accessToken = await this.jwtService.sign({
      userId: user.id,
      corpId: user.corpId,
      username: user.username,
      roles: user.roles.map(r => r.code)
    }, {
      expiresIn: '2h'
    });

    const refreshToken = await this.jwtService.sign({
      userId: user.id,
      type: 'refresh'
    }, {
      expiresIn: '7d'
    });

    // 4. 更新最后登录时间
    await this.userRepo.update(user.id, {
      lastLoginTime: new Date()
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        corpId: user.corpId
      }
    };
  }

  /**
   * 用户注册
   */
  async register(dto: RegisterDto) {
    // 1. 检查用户名是否存在
    const exists = await this.userRepo.findOne({
      where: { username: dto.username }
    });

    if (exists) {
      throw new Error('用户名已存在');
    }

    // 2. 检查密码强度
    const { isValid, message } = this.passwordUtil.checkPasswordStrength(dto.password);
    if (!isValid) {
      throw new Error(message);
    }

    // 3. 加密密码
    const hashedPassword = await this.passwordUtil.hashPassword(dto.password);

    // 4. 创建用户
    const user = this.userRepo.create({
      username: dto.username,
      password: hashedPassword,
      realName: dto.realName,
      mobile: dto.mobile,
      email: dto.email,
      corpId: dto.corpId
    });

    await this.userRepo.save(user);

    return {
      id: user.id,
      username: user.username
    };
  }

  /**
   * 刷新Token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verify(refreshToken);

      if (payload.type !== 'refresh') {
        throw new Error('无效的刷新Token');
      }

      // 查询用户
      const user = await this.userRepo.findOne({
        where: { id: payload.userId },
        relations: ['roles']
      });

      if (!user || user.status !== 1) {
        throw new Error('用户不存在或已被禁用');
      }

      // 生成新Token
      const accessToken = await this.jwtService.sign({
        userId: user.id,
        corpId: user.corpId,
        username: user.username,
        roles: user.roles.map(r => r.code)
      }, {
        expiresIn: '2h'
      });

      return { accessToken };
    } catch (error) {
      throw new Error('Token刷新失败');
    }
  }

  /**
   * 验证Token
   */
  async verifyToken(token: string) {
    try {
      const payload = await this.jwtService.verify(token);
      return payload;
    } catch (error) {
      throw new Error('Token无效');
    }
  }
}
```

### 3. 密码工具

```typescript
// utils/PasswordUtil.ts
import * as bcrypt from 'bcrypt';
import { Provide } from '@midwayjs/core';

@Provide()
export class PasswordUtil {
  private saltRounds = 12;

  /**
   * 哈希密码
   */
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
  }

  /**
   * 验证密码
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * 检查密码强度
   */
  checkPasswordStrength(password: string): {
    isValid: boolean;
    message: string;
  } {
    // 至少8位，包含大小写字母、数字和特殊字符
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    
    if (!strongPasswordRegex.test(password)) {
      return {
        isValid: false,
        message: '密码至少8位，需包含大小写字母、数字和特殊字符'
      };
    }
    
    return { isValid: true, message: '密码强度合格' };
  }
}
```

### 4. 认证控制器

```typescript
// controller/AuthController.ts
import { Controller, Post, Body, Inject } from '@midwayjs/core';
import { AuthService } from '../service/AuthService';
import { LoginDto } from '../dto/LoginDto';
import { RegisterDto } from '../dto/RegisterDto';
import { Validate } from '@midwayjs/validate';

@Controller('/api/v1/auth')
export class AuthController {
  @Inject()
  authService: AuthService;

  @Post('/login')
  @Validate()
  async login(@Body() dto: LoginDto) {
    return await this.authService.login(dto);
  }

  @Post('/register')
  @Validate()
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(dto);
  }

  @Post('/refresh-token')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return await this.authService.refreshToken(refreshToken);
  }

  @Post('/verify-token')
  async verifyToken(@Body('token') token: string) {
    return await this.authService.verifyToken(token);
  }

  @Post('/logout')
  async logout() {
    // 客户端删除Token即可
    return { message: '登出成功' };
  }
}
```

### 5. 权限装饰器

```typescript
// decorator/RequirePermission.ts
import { createCustomParamDecorator } from '@midwayjs/core';

export function RequirePermission(permission: string | string[]) {
  return createCustomParamDecorator((ctx) => {
    const userPermissions = ctx.state.user?.permissions || [];
    const requiredPermissions = Array.isArray(permission) ? permission : [permission];
    
    const hasPermission = requiredPermissions.some(p => 
      userPermissions.includes(p)
    );
    
    if (!hasPermission) {
      throw new Error('权限不足');
    }
    
    return true;
  });
}
```

---

## 🔐 RBAC权限模型

### 数据结构

```
用户 (User)
  └─ 多对多 ─> 角色 (Role)
                 └─ 多对多 ─> 权限 (Permission)
```

### 使用示例

```typescript
@Controller('/api/v1/users')
export class UserController {
  @Delete('/:id')
  @RequirePermission('user:delete')
  async deleteUser(@Param('id') id: number) {
    // 只有拥有 user:delete 权限的用户才能访问
  }
}
```

---

## ⚙️ 配置

```typescript
// config/config.default.ts
export default {
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '2h'
  },
  
  typeorm: {
    dataSource: {
      default: {
        type: 'mysql',
        host: process.env.DB_HOST,
        port: 3306,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: 'scrm_auth',
        synchronize: false,
        entities: ['**/entity/*.entity{.ts,.js}']
      }
    }
  }
}
```

---

## 📞 联系方式

- 负责人: [待填写]
- 开发: [待填写]

---

**端口**: 7001  
**最后更新**: 2025-10-28

