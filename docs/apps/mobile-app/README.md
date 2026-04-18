# 移动端应用 (Mobile App)

> 基于UniApp + NutUI的跨端移动应用

---

## 📋 项目概览

运营人员和销售人员的移动办公工具，支持微信小程序、H5、iOS和Android多端运行。提供客户管理、待办任务、消息通知等核心功能，方便随时随地处理工作。

### 核心功能

- 🏠 **工作台**: 待办任务、快捷入口、数据概览
- 👥 **客户管理**: 客户列表、客户详情、快速跟进
- 📬 **消息通知**: 系统通知、任务提醒、实时推送
- 📋 **SOP执行**: 待执行任务、执行记录、任务提醒
- 📊 **数据看板**: 个人数据、实时更新、趋势图表
- 🎯 **朋友圈**: 朋友圈素材、一键发布、效果追踪

---

## 🛠️ 技术栈

- **框架**: UniApp 3.x (Vue 3版本)
- **语言**: TypeScript 5.x
- **UI组件**: NutUI 4.x (京东开源)
- **状态管理**: Pinia 2.x
- **HTTP**: uni.request (封装)
- **工具库**: dayjs
- **多端支持**: 
  - 微信小程序
  - H5
  - iOS App
  - Android App

---

## 📁 项目结构

```
mobile-app/
├── src/
│   ├── pages/                  # 页面
│   │   ├── index/              # 首页(工作台)
│   │   │   └── index.vue
│   │   ├── customer/           # 客户模块
│   │   │   ├── list.vue
│   │   │   └── detail.vue
│   │   ├── task/               # 任务模块
│   │   │   ├── list.vue
│   │   │   └── detail.vue
│   │   ├── message/            # 消息模块
│   │   │   └── list.vue
│   │   ├── data/               # 数据看板
│   │   │   └── index.vue
│   │   ├── moments/            # 朋友圈
│   │   │   └── list.vue
│   │   └── user/               # 个人中心
│   │       └── index.vue
│   │
│   ├── components/             # 组件
│   │   ├── customer-card/
│   │   │   └── index.vue
│   │   ├── task-item/
│   │   │   └── index.vue
│   │   └── stat-card/
│   │       └── index.vue
│   │
│   ├── composables/            # Hooks
│   │   ├── use-customer.ts
│   │   ├── use-task.ts
│   │   └── use-request.ts
│   │
│   ├── stores/                 # Pinia stores
│   │   ├── user-store.ts
│   │   ├── app-store.ts
│   │   └── customer-store.ts
│   │
│   ├── utils/                  # 工具函数
│   │   ├── request.ts          # 请求封装
│   │   ├── storage.ts          # 本地存储
│   │   └── format.ts           # 格式化
│   │
│   ├── types/                  # 类型定义
│   │   └── index.ts
│   │
│   ├── static/                 # 静态资源
│   │   └── images/
│   │
│   ├── app.vue                 # 应用入口
│   └── main.ts                 # 入口文件
│
├── manifest.json               # 应用配置
├── pages.json                  # 页面配置
├── uni.scss                    # 全局样式
├── tsconfig.json               # TS配置
└── package.json                # 依赖配置
```

---

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发

```bash
# H5
pnpm dev:h5

# 微信小程序 (需要安装微信开发者工具)
pnpm dev:mp-weixin

# App (需要安装HBuilderX)
pnpm dev:app
```

### 构建

```bash
# H5
pnpm build:h5

# 微信小程序
pnpm build:mp-weixin

# App
pnpm build:app
```

---

## 📝 开发指南

### 页面配置

```json
// pages.json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {
        "navigationBarTitleText": "工作台"
      }
    },
    {
      "path": "pages/customer/list",
      "style": {
        "navigationBarTitleText": "客户列表"
      }
    }
  ],
  "tabBar": {
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "工作台",
        "iconPath": "static/tabbar/home.png",
        "selectedIconPath": "static/tabbar/home-active.png"
      },
      {
        "pagePath": "pages/customer/list",
        "text": "客户",
        "iconPath": "static/tabbar/customer.png",
        "selectedIconPath": "static/tabbar/customer-active.png"
      }
    ]
  }
}
```

### 使用NutUI组件

```vue
<template>
  <view class="page">
    <!-- 按钮 -->
    <nut-button type="primary" @click="handleClick">
      提交
    </nut-button>
    
    <!-- 单元格 -->
    <nut-cell-group>
      <nut-cell title="客户姓名" :desc="customer.name" />
      <nut-cell title="手机号" :desc="customer.mobile" />
    </nut-cell-group>
    
    <!-- 列表 -->
    <nut-list
      v-model="loading"
      :finished="finished"
      @load="loadMore"
    >
      <view
        v-for="item in list"
        :key="item.id"
        class="list-item"
      >
        {{ item.name }}
      </view>
    </nut-list>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const loading = ref(false)
const finished = ref(false)
const list = ref([])

const loadMore = async () => {
  // 加载更多数据
}

const handleClick = () => {
  uni.showToast({
    title: '提交成功',
    icon: 'success'
  })
}
</script>
```

### 请求封装

```typescript
// utils/request.ts
import { useUserStore } from '@/stores/user-store'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: any
}

export const request = <T = any>(options: RequestOptions): Promise<T> => {
  const userStore = useUserStore()
  
  return new Promise((resolve, reject) => {
    uni.request({
      url: import.meta.env.VITE_API_BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userStore.token}`,
        ...options.header
      },
      success: (res: any) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          reject(res.data)
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}
```

### Hooks示例

```typescript
// composables/use-customer.ts
import { ref } from 'vue'
import type { Customer } from '@scrm/shared-types'
import { request } from '@/utils/request'

export const useCustomer = () => {
  const customerList = ref<Customer[]>([])
  const loading = ref(false)
  const finished = ref(false)
  const page = ref(1)
  
  const fetchCustomers = async () => {
    if (loading.value) return
    
    loading.value = true
    try {
      const res = await request<any>({
        url: '/api/v1/customers',
        method: 'GET',
        data: {
          page: page.value,
          size: 20
        }
      })
      
      customerList.value.push(...res.data.list)
      
      if (res.data.list.length < 20) {
        finished.value = true
      } else {
        page.value++
      }
    } finally {
      loading.value = false
    }
  }
  
  return {
    customerList,
    loading,
    finished,
    fetchCustomers
  }
}
```

### 页面示例

```vue
<!-- pages/customer/list.vue -->
<template>
  <view class="customer-list">
    <nut-search-bar
      v-model="keyword"
      placeholder="搜索客户"
      @search="handleSearch"
    />
    
    <nut-list
      v-model="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="fetchCustomers"
    >
      <view
        v-for="customer in customerList"
        :key="customer.id"
        class="customer-item"
        @click="goToDetail(customer.id)"
      >
        <customer-card :customer="customer" />
      </view>
    </nut-list>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useCustomer } from '@/composables/use-customer'

const keyword = ref('')
const { customerList, loading, finished, fetchCustomers } = useCustomer()

const handleSearch = () => {
  // 搜索逻辑
}

const goToDetail = (id: number) => {
  uni.navigateTo({
    url: `/pages/customer/detail?id=${id}`
  })
}
</script>

<style lang="scss" scoped>
.customer-list {
  padding: 20rpx;
}

.customer-item {
  margin-bottom: 20rpx;
}
</style>
```

---

## 🎨 样式规范

### rpx单位

UniApp使用rpx作为响应式单位 (750rpx = 屏幕宽度)

```scss
.container {
  padding: 20rpx;        // 20px (iPhone 6)
  font-size: 28rpx;      // 14px
  width: 750rpx;         // 100%
}
```

### 全局样式

```scss
// uni.scss
$primary-color: #1890ff;
$success-color: #52c41a;
$warning-color: #faad14;
$error-color: #f5222d;

.primary-text {
  color: $primary-color;
}
```

---

## 📱 多端适配

### 条件编译

```vue
<template>
  <view>
    <!-- #ifdef MP-WEIXIN -->
    <view>微信小程序专用</view>
    <!-- #endif -->
    
    <!-- #ifdef H5 -->
    <view>H5专用</view>
    <!-- #endif -->
    
    <!-- #ifdef APP-PLUS -->
    <view>App专用</view>
    <!-- #endif -->
  </view>
</template>

<script>
// #ifdef MP-WEIXIN
// 微信小程序代码
// #endif

// #ifdef H5
// H5代码
// #endif
</script>
```

---

## 🔔 推送通知

### 消息推送

```typescript
// 获取推送权限
uni.getProvider({
  service: 'push',
  success: (res) => {
    if (res.provider) {
      uni.getPushClientId({
        success: (res) => {
          // 上传clientId到服务器
        }
      })
    }
  }
})
```

---

## 📞 联系方式

- 负责人: [待填写]
- 开发: [待填写]

---

**端口**: H5端口根据配置  
**最后更新**: 2025-10-28

