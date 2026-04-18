# 管理平台 (Admin Platform)

> 基于Vue 3 + Element Plus的企业管理后台

---

## 📋 项目概览

企业管理者和IT管理员使用的管理平台，负责企业信息管理、权限配置、系统设置等核心管理功能。

### 核心功能

- 🏢 **企业管理**: 企业信息、部门管理、员工管理
- 🔐 **权限管理**: 角色管理、权限配置、数据权限
- ⚙️ **系统配置**: 基础配置、第三方集成配置
- 👥 **账号管理**: 平台账号、渠道账号绑定
- 💳 **套餐管理**: 套餐升级、功能开通
- 📋 **账单中心**: 费用查询、发票管理
- 📝 **操作日志**: 审计日志、操作记录

---

## 🛠️ 技术栈

- **框架**: Vue 3.3+ (Composition API)
- **构建工具**: Vite 4.x
- **语言**: TypeScript 5.x
- **UI组件**: Element Plus 2.x
- **状态管理**: Pinia 2.x
- **路由**: Vue Router 4.x
- **HTTP**: Axios 1.x
- **图表**: ECharts 5.x + vue-echarts
- **工具库**: dayjs、lodash-es

---

## 📁 项目结构

```
admin-platform/
├── src/
│   ├── api/                    # API接口 (kebab-case)
│   │   ├── auth-api.ts
│   │   ├── enterprise-api.ts
│   │   ├── user-api.ts
│   │   └── role-api.ts
│   │
│   ├── assets/                 # 静态资源
│   │   ├── images/
│   │   └── styles/
│   │       ├── variables.css
│   │       └── global.css
│   │
│   ├── components/             # 组件 (kebab-case)
│   │   ├── common/
│   │   │   ├── page-header.vue
│   │   │   ├── data-table.vue
│   │   │   └── form-dialog.vue
│   │   └── layout/
│   │       ├── main-layout.vue
│   │       ├── sidebar.vue
│   │       └── navbar.vue
│   │
│   ├── composables/            # Hooks (use-前缀)
│   │   ├── use-auth.ts
│   │   ├── use-table.ts
│   │   ├── use-permission.ts
│   │   └── use-request.ts
│   │
│   ├── config/                 # 配置
│   │   └── app-config.ts
│   │
│   ├── directives/             # 自定义指令
│   │   ├── permission.ts
│   │   └── loading.ts
│   │
│   ├── router/                 # 路由
│   │   ├── index.ts
│   │   ├── routes.ts
│   │   └── guards.ts
│   │
│   ├── stores/                 # Pinia stores
│   │   ├── user-store.ts
│   │   ├── app-store.ts
│   │   └── permission-store.ts
│   │
│   ├── types/                  # 类型定义
│   │   └── env.d.ts
│   │
│   ├── utils/                  # 工具函数
│   │   ├── request.ts
│   │   ├── storage.ts
│   │   └── validate.ts
│   │
│   ├── views/                  # 页面 (kebab-case)
│   │   ├── dashboard/
│   │   │   └── index.vue
│   │   ├── enterprise/
│   │   │   ├── info.vue
│   │   │   ├── department.vue
│   │   │   └── employee.vue
│   │   ├── system/
│   │   │   ├── role.vue
│   │   │   ├── permission.vue
│   │   │   └── config.vue
│   │   └── account/
│   │       ├── profile.vue
│   │       └── security.vue
│   │
│   ├── app.vue
│   └── main.ts
│
├── public/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发

```bash
pnpm dev
```

### 构建

```bash
pnpm build
pnpm preview
```

---

## 📝 开发指南

### Hooks示例

```typescript
// composables/use-enterprise.ts
import { ref } from 'vue'
import type { Enterprise } from '@scrm/shared-types'
import * as enterpriseApi from '@/api/enterprise-api'

export const useEnterprise = () => {
  const enterpriseInfo = ref<Enterprise | null>(null)
  const loading = ref(false)
  
  const fetchEnterprise = async () => {
    loading.value = true
    try {
      const res = await enterpriseApi.getEnterpriseInfo()
      enterpriseInfo.value = res.data
    } finally {
      loading.value = false
    }
  }
  
  const updateEnterprise = async (data: Partial<Enterprise>) => {
    await enterpriseApi.updateEnterprise(data)
    await fetchEnterprise()
  }
  
  return {
    enterpriseInfo,
    loading,
    fetchEnterprise,
    updateEnterprise
  }
}
```

### 权限指令

```typescript
// directives/permission.ts
import type { Directive } from 'vue'
import { usePermissionStore } from '@/stores/permission-store'

export const permission: Directive = {
  mounted(el, binding) {
    const { value } = binding
    const permissionStore = usePermissionStore()
    
    if (!permissionStore.hasPermission(value)) {
      el.parentNode?.removeChild(el)
    }
  }
}
```

---

## 🔐 权限管理

### RBAC模型

```typescript
interface Role {
  id: number
  name: string
  code: string
  permissions: Permission[]
}

interface Permission {
  id: number
  name: string
  code: string
  type: 'menu' | 'button' | 'api'
}
```

### 使用示例

```vue
<template>
  <!-- 使用指令 -->
  <el-button v-permission="'user:create'">新增用户</el-button>
  
  <!-- 使用方法 -->
  <el-button v-if="hasPermission('user:delete')">删除</el-button>
</template>

<script setup lang="ts">
import { usePermissionStore } from '@/stores/permission-store'

const permissionStore = usePermissionStore()
const hasPermission = permissionStore.hasPermission
</script>
```

---

## 📞 联系方式

- 负责人: [待填写]
- 开发: [待填写]

---

**端口**: 3001  
**最后更新**: 2025-10-28

