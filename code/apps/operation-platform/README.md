# 运营平台 (Operation Platform)

> 基于Vue 3 + Element Plus的客户运营平台

---

## 📋 项目概览

运营人员、销售人员和市场人员使用的核心工作平台，负责多渠道获客、客户运营、SOP管理、社群运营等核心业务功能。

### 核心功能

- 🚀 **获客管理**: 抖音/小红书内容发布、渠道活码、引流链接
- 👥 **客户管理**: 客户列表、客户画像、客户跟进、标签管理
- 🤖 **SOP管理**: SOP配置、SOP执行、任务管理、自动化流程
- 💬 **社群管理**: 群管理、群SOP、群活动、防骚扰规则
- 🏷️ **标签管理**: 标签配置、自动打标、智能分组
- 📤 **消息群发**: 批量群发、定向推送、消息模板
- 🎨 **海报生成**: 海报模板、一键生成、批量下载
- 🏪 **门店管理**: 门店管理、活动管理、数据统计
- 📚 **素材库**: 图片、视频、文案素材管理
- 📊 **数据看板**: 个人数据、团队数据、实时统计

---

## 🛠️ 技术栈

- **框架**: Vue 3.3+ (Composition API)
- **构建工具**: Vite 4.x
- **语言**: TypeScript 5.x
- **UI组件**: Element Plus 2.x
- **状态管理**: Pinia 2.x
- **路由**: Vue Router 4.x
- **HTTP**: Axios 1.x
- **图表**: ECharts 5.x
- **富文本**: WangEditor 5.x
- **海报生成**: Fabric.js 5.x
- **二维码**: qrcode
- **工具库**: dayjs、lodash-es

---

## 📁 项目结构

```
operation-platform/
├── src/
│   ├── api/                    # API接口
│   │   ├── customer-api.ts
│   │   ├── sop-api.ts
│   │   ├── community-api.ts
│   │   ├── acquisition-api.ts
│   │   └── material-api.ts
│   │
│   ├── components/             # 组件
│   │   ├── common/
│   │   │   ├── user-avatar.vue
│   │   │   ├── data-table.vue
│   │   │   └── tag-selector.vue
│   │   ├── business/
│   │   │   ├── customer-card.vue
│   │   │   ├── sop-timeline.vue
│   │   │   ├── poster-editor.vue
│   │   │   └── qrcode-generator.vue
│   │   └── layout/
│   │       ├── main-layout.vue
│   │       └── sidebar.vue
│   │
│   ├── composables/            # Hooks
│   │   ├── use-customer.ts
│   │   ├── use-sop.ts
│   │   ├── use-community.ts
│   │   ├── use-material.ts
│   │   └── use-poster.ts
│   │
│   ├── views/                  # 页面
│   │   ├── dashboard/
│   │   │   └── index.vue
│   │   ├── acquisition/        # 获客模块
│   │   │   ├── channel-qrcode.vue
│   │   │   ├── content-publish.vue
│   │   │   └── link-management.vue
│   │   ├── customer/           # 客户模块
│   │   │   ├── customer-list.vue
│   │   │   ├── customer-detail.vue
│   │   │   └── customer-follow.vue
│   │   ├── sop/                # SOP模块
│   │   │   ├── sop-list.vue
│   │   │   ├── sop-config.vue
│   │   │   └── sop-execution.vue
│   │   ├── community/          # 社群模块
│   │   │   ├── community-list.vue
│   │   │   ├── community-detail.vue
│   │   │   └── community-sop.vue
│   │   ├── material/           # 素材库
│   │   │   ├── material-library.vue
│   │   │   └── poster-generator.vue
│   │   └── data/               # 数据看板
│   │       └── personal-stats.vue
│   │
│   ├── app.vue
│   └── main.ts
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
```

---

## 📝 核心功能实现

### 1. 客户管理Hooks

```typescript
// composables/use-customer.ts
import { ref, computed } from 'vue'
import type { Customer, CustomerQuery } from '@scrm/shared-types'
import * as customerApi from '@/api/customer-api'

export const useCustomer = () => {
  const customerList = ref<Customer[]>([])
  const total = ref(0)
  const loading = ref(false)
  
  // 获取客户列表
  const fetchCustomers = async (query?: CustomerQuery) => {
    loading.value = true
    try {
      const res = await customerApi.getCustomerList(query)
      customerList.value = res.data.list
      total.value = res.data.total
    } finally {
      loading.value = false
    }
  }
  
  // 客户打标
  const addTag = async (customerId: number, tagIds: number[]) => {
    await customerApi.addCustomerTags(customerId, tagIds)
    await fetchCustomers()
  }
  
  // 客户跟进
  const followUp = async (customerId: number, content: string) => {
    await customerApi.createFollowUpRecord({
      customerId,
      content,
      followTime: new Date()
    })
  }
  
  return {
    customerList,
    total,
    loading,
    fetchCustomers,
    addTag,
    followUp
  }
}
```

### 2. SOP配置

```vue
<template>
  <div class="sop-config">
    <el-form :model="sopForm">
      <el-form-item label="SOP名称">
        <el-input v-model="sopForm.name" />
      </el-form-item>
      
      <el-form-item label="触发条件">
        <el-select v-model="sopForm.triggerType">
          <el-option label="添加好友" value="add_friend" />
          <el-option label="客户打标" value="tag" />
          <el-option label="进入社群" value="join_group" />
        </el-select>
      </el-form-item>
      
      <!-- SOP步骤配置 -->
      <el-form-item label="执行步骤">
        <sop-step-config v-model="sopForm.steps" />
      </el-form-item>
      
      <el-button type="primary" @click="saveSop">保存</el-button>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { SopConfig } from '@scrm/shared-types'

const sopForm = ref<SopConfig>({
  name: '',
  triggerType: 'add_friend',
  steps: []
})

const saveSop = async () => {
  // 保存SOP配置
}
</script>
```

### 3. 海报生成

```typescript
// composables/use-poster.ts
import { fabric } from 'fabric'
import { ref } from 'vue'

export const usePoster = () => {
  const canvas = ref<fabric.Canvas | null>(null)
  
  // 初始化画布
  const initCanvas = (el: HTMLCanvasElement) => {
    canvas.value = new fabric.Canvas(el, {
      width: 750,
      height: 1334
    })
  }
  
  // 添加背景图
  const addBackground = (url: string) => {
    fabric.Image.fromURL(url, (img) => {
      img.set({
        scaleX: 750 / img.width!,
        scaleY: 1334 / img.height!
      })
      canvas.value?.setBackgroundImage(img, canvas.value.renderAll.bind(canvas.value))
    })
  }
  
  // 添加二维码
  const addQRCode = async (url: string, x: number, y: number) => {
    // 生成二维码并添加到画布
  }
  
  // 导出图片
  const exportImage = (): string => {
    return canvas.value?.toDataURL({
      format: 'png',
      quality: 1
    }) || ''
  }
  
  return {
    initCanvas,
    addBackground,
    addQRCode,
    exportImage
  }
}
```

### 4. 渠道活码

```vue
<template>
  <div class="channel-qrcode">
    <el-form :model="qrcodeForm">
      <el-form-item label="活码名称">
        <el-input v-model="qrcodeForm.name" />
      </el-form-item>
      
      <el-form-item label="渠道来源">
        <el-select v-model="qrcodeForm.channel">
          <el-option label="抖音" value="douyin" />
          <el-option label="小红书" value="xiaohongshu" />
          <el-option label="线下门店" value="store" />
        </el-select>
      </el-form-item>
      
      <el-form-item label="分配员工">
        <el-select v-model="qrcodeForm.staffIds" multiple>
          <el-option 
            v-for="staff in staffList"
            :key="staff.id"
            :label="staff.name"
            :value="staff.id"
          />
        </el-select>
      </el-form-item>
      
      <el-form-item label="欢迎语">
        <el-input 
          v-model="qrcodeForm.welcomeMsg" 
          type="textarea"
          rows="4"
        />
      </el-form-item>
    </el-form>
    
    <!-- 生成的二维码预览 -->
    <div v-if="qrcodeUrl" class="qrcode-preview">
      <img :src="qrcodeUrl" alt="活码">
      <el-button @click="downloadQRCode">下载二维码</el-button>
    </div>
  </div>
</template>
```

---

## 🎨 UI组件示例

### 客户卡片

```vue
<!-- components/business/customer-card.vue -->
<template>
  <el-card class="customer-card">
    <div class="customer-header">
      <user-avatar :src="customer.avatar" :name="customer.name" />
      <div class="customer-info">
        <h3>{{ customer.name }}</h3>
        <span class="customer-mobile">{{ customer.mobile }}</span>
      </div>
    </div>
    
    <div class="customer-tags">
      <el-tag 
        v-for="tag in customer.tags"
        :key="tag.id"
        size="small"
      >
        {{ tag.name }}
      </el-tag>
    </div>
    
    <div class="customer-stats">
      <div class="stat-item">
        <span class="label">添加时间</span>
        <span class="value">{{ formatDate(customer.addTime) }}</span>
      </div>
      <div class="stat-item">
        <span class="label">跟进次数</span>
        <span class="value">{{ customer.followCount }}</span>
      </div>
    </div>
  </el-card>
</template>
```

---

## 📊 数据看板

### 个人数据统计

```typescript
// composables/use-personal-stats.ts
export const usePersonalStats = () => {
  const stats = ref({
    todayAddCount: 0,      // 今日新增客户
    totalCustomerCount: 0, // 客户总数
    sopTaskCount: 0,       // 待执行SOP
    followUpCount: 0       // 待跟进客户
  })
  
  const fetchStats = async () => {
    const res = await statsApi.getPersonalStats()
    stats.value = res.data
  }
  
  return { stats, fetchStats }
}
```

---

## 📞 联系方式

- 负责人: [待填写]
- 产品: [待填写]
- 开发: [待填写]

---

**端口**: 3003  
**最后更新**: 2025-10-28

