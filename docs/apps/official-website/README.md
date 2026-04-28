# 官方网站 (Official Website)

> 基于Nuxt 4的企业官网，支持SSR/SSG，SEO友好

> **仓库内可运行骨架（Sprint 6）**：Monorepo 内见 `code/apps/official-website`（Vite + Vue 3，`pnpm dev` 默认 **3010**）；以下为中长期产品/技术规划，与当前 `code/apps` 工程可并存演进。

---

## 📋 项目概览

企业SCRM系统的官方展示网站，用于产品宣传、功能介绍、客户案例展示、在线咨询等。采用Nuxt 4 + TailwindCSS构建，支持服务端渲染(SSR)和静态生成(SSG)，确保良好的SEO效果和首屏加载速度。

###核心功能

- 🏠 **首页**: 产品核心卖点、功能亮点、客户logo墙
- 📦 **产品介绍**: 详细功能模块、应用场景、技术优势
- 💼 **解决方案**: 按行业/场景的解决方案展示
- 📊 **客户案例**: 成功案例、效果数据、客户评价
- 💰 **价格套餐**: 套餐对比、功能清单、在线购买
- 📰 **资讯博客**: 行业资讯、产品动态、使用教程
- 📚 **帮助中心**: 使用文档、FAQ、视频教程
- 💬 **在线咨询**: 留资表单、在线客服、联系方式

---

## 🛠️ 技术栈

- **框架**: Nuxt 4 (Vue 3 + SSR/SSG)
- **语言**: TypeScript 5.x
- **样式**: TailwindCSS 3.x + PostCSS
- **UI组件**: 自定义组件 + Headless UI
- **图标**: Heroicons
- **动画**: @vueuse/motion
- **表单**: VeeValidate
- **状态管理**: Pinia (按需)
- **HTTP**: $fetch (Nuxt内置)

---

## 📁 项目结构

```
official-website/
├── app/                        # Nuxt 4 app目录
├── pages/                      # 页面 (自动路由)
│   ├── index.vue               # 首页
│   ├── products/               # 产品页
│   │   ├── index.vue           # 产品列表
│   │   └── [slug].vue          # 产品详情
│   ├── solutions/              # 解决方案
│   ├── cases/                  # 客户案例
│   ├── pricing.vue             # 价格套餐
│   ├── blog/                   # 博客
│   │   ├── index.vue           # 博客列表
│   │   └── [slug].vue          # 文章详情
│   ├── docs/                   # 帮助文档
│   └── about/                  # 关于我们
│       ├── company.vue         # 公司介绍
│       ├── team.vue            # 团队介绍
│       └── contact.vue         # 联系我们
│
├── components/                 # 组件
│   ├── common/                 # 通用组件
│   │   ├── header.vue          # 头部导航
│   │   ├── footer.vue          # 底部
│   │   ├── seo-head.vue        # SEO头部
│   │   └── breadcrumb.vue      # 面包屑
│   ├── home/                   # 首页组件
│   │   ├── hero-section.vue    # 主横幅
│   │   ├── feature-grid.vue    # 功能网格
│   │   ├── case-carousel.vue   # 案例轮播
│   │   └── cta-section.vue     # 行动号召
│   ├── products/               # 产品组件
│   ├── solutions/              # 解决方案组件
│   └── forms/                  # 表单组件
│       ├── contact-form.vue    # 联系表单
│       └── trial-form.vue      # 试用申请表单
│
├── composables/                # Hooks
│   ├── use-seo.ts              # SEO hooks
│   ├── use-contact.ts          # 联系表单hooks
│   └── use-analytics.ts        # 埋点hooks
│
├── content/                    # 内容 (Markdown)
│   ├── blog/                   # 博客文章
│   └── docs/                   # 文档
│
├── server/                     # 服务端
│   ├── api/                    # API路由
│   │   ├── contact.post.ts     # 联系表单提交
│   │   └── trial.post.ts       # 试用申请
│   └── middleware/             # 服务端中间件
│
├── public/                     # 静态资源
│   ├── images/                 # 图片
│   ├── videos/                 # 视频
│   └── favicon.ico             # 网站图标
│
├── assets/                     # 资源文件
│   └── css/                    # 样式
│       └── main.css            # 主样式文件
│
├── nuxt.config.ts              # Nuxt配置
├── tailwind.config.ts          # TailwindCSS配置
├── tsconfig.json               # TypeScript配置
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
# 启动开发服务器 (http://localhost:3000)
pnpm dev

# 启动开发服务器并打开浏览器
pnpm dev --open
```

### 构建

```bash
# 构建生产版本 (SSR)
pnpm build

# 生成静态站点 (SSG)
pnpm generate

# 预览生产构建
pnpm preview
```

---

## 📝 开发指南

### 页面开发

**创建新页面:**

```vue
<!-- pages/example.vue -->
<script setup lang="ts">
import { useSeoMeta } from '#app'

// SEO配置
useSeoMeta({
  title: '示例页面 - SCRM系统',
  description: '页面描述',
  ogTitle: 'SCRM系统',
  ogDescription: '页面描述',
  ogImage: '/images/og-image.jpg'
})
</script>

<template>
  <div>
    <h1>示例页面</h1>
  </div>
</template>
```

### 组件开发

**命名规范**: kebab-case

```vue
<!-- components/common/feature-card.vue -->
<script setup lang="ts">
interface Props {
  title: string
  description: string
  icon?: string
}

const props = defineProps<Props>()
</script>

<template>
  <div class="feature-card">
    <div v-if="icon" class="icon">{{ icon }}</div>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
  </div>
</template>

<style scoped>
.feature-card {
  @apply rounded-lg border p-6 shadow-sm hover:shadow-md transition-shadow;
}
</style>
```

### 内容管理

使用Nuxt Content管理Markdown内容:

```vue
<script setup lang="ts">
const { data: article } = await useAsyncData('article', () =>
  queryContent('/blog/example').findOne()
)
</script>

<template>
  <ContentDoc :value="article" />
</template>
```

### API开发

```typescript
// server/api/contact.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  // 验证数据
  if (!body.name || !body.email) {
    throw createError({
      statusCode: 400,
      message: '缺少必填字段'
    })
  }
  
  // 发送到后端API
  const result = await $fetch('/api/v1/leads', {
    method: 'POST',
    baseURL: process.env.API_BASE_URL,
    body
  })
  
  return result
})
```

---

## 🎨 样式指南

### TailwindCSS使用

```vue
<template>
  <!-- 响应式设计 -->
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold">
      标题
    </h1>
  </div>
  
  <!-- 自定义类 -->
  <button class="btn btn-primary">
    立即试用
  </button>
</template>

<style>
/* 在tailwind.config.ts中定义自定义类 */
@layer components {
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-colors;
  }
  
  .btn-primary {
    @apply bg-blue-600 text-white hover:bg-blue-700;
  }
}
</style>
```

---

## 📊 SEO优化

### Meta标签

```typescript
// composables/use-seo.ts
export const useSeo = (options: {
  title?: string
  description?: string
  image?: string
  keywords?: string[]
}) => {
  const { title, description, image, keywords } = options
  
  useSeoMeta({
    title: title ? `${title} - SCRM系统` : 'SCRM系统',
    description,
    keywords: keywords?.join(', '),
    ogTitle: title,
    ogDescription: description,
    ogImage: image || '/images/og-default.jpg',
    twitterCard: 'summary_large_image'
  })
}
```

### 结构化数据

```typescript
useHead({
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'SCRM系统',
        url: 'https://scrm.example.com',
        logo: 'https://scrm.example.com/logo.png'
      })
    }
  ]
})
```

---

## 📈 性能优化

### 图片优化

```vue
<template>
  <!-- 使用Nuxt Image -->
  <NuxtImg
    src="/images/hero.jpg"
    alt="Hero"
    width="1200"
    height="600"
    format="webp"
    loading="lazy"
  />
</template>
```

### 代码分割

```typescript
// 懒加载组件
const HeavyComponent = defineAsyncComponent(() =>
  import('~/components/heavy-component.vue')
)
```

---

## 🔧 配置

### Nuxt配置

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/content',
    '@nuxt/image',
    '@vueuse/nuxt'
  ],
  
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
    }
  },
  
  runtimeConfig: {
    // 服务端可用
    apiSecret: process.env.API_SECRET,
    
    public: {
      // 客户端可用
      apiBase: process.env.API_BASE_URL
    }
  }
})
```

---

## 🚢 部署

### 静态站点 (SSG)

```bash
# 生成静态文件
pnpm generate

# 部署到Vercel/Netlify
# 输出目录: .output/public
```

### SSR部署

```bash
# 构建
pnpm build

# 启动
node .output/server/index.mjs
```

### Docker部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY .output /app/.output
ENV NODE_ENV=production
CMD ["node", ".output/server/index.mjs"]
```

---

## 📞 联系方式

- 负责人: [待填写]
- 设计: [待填写]
- 开发: [待填写]

---

**端口**: 3000  
**最后更新**: 2025-10-28

