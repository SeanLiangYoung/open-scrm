<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="layout-aside">
      <div class="logo"><h2>SCRM 运营</h2></div>
      <el-menu :default-active="route.path" router background-color="#0f172a" text-color="#94a3b8" active-text-color="#fff">
        <el-menu-item index="/"><el-icon><Odometer /></el-icon><span>数据看板</span></el-menu-item>
        <el-sub-menu index="customer-group">
          <template #title><el-icon><User /></el-icon><span>客户管理</span></template>
          <el-menu-item index="/customers">客户列表</el-menu-item>
          <el-menu-item index="/tags">标签管理</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/channels">
          <el-icon><Promotion /></el-icon><span>渠道管理</span>
        </el-menu-item>
        <el-sub-menu index="msg-group">
          <template #title><el-icon><ChatDotRound /></el-icon><span>消息中心</span></template>
          <el-menu-item index="/message-templates">消息模板</el-menu-item>
          <el-menu-item index="/notifications">通知中心</el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="sop-group">
          <template #title><el-icon><List /></el-icon><span>运营工具</span></template>
          <el-menu-item index="/sop">SOP 管理</el-menu-item>
          <el-menu-item index="/sop/executions">执行记录</el-menu-item>
          <el-menu-item index="/mass-task">群发任务</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="layout-header">
        <span class="page-title">{{ pageTitle }}</span>
        <el-dropdown @command="handleCmd">
          <span class="user-info"><el-avatar :size="32" :icon="UserFilled" /><span class="uname">{{ authStore.user?.username }}</span></span>
          <template #dropdown><el-dropdown-menu><el-dropdown-item command="logout">退出登录</el-dropdown-item></el-dropdown-menu></template>
        </el-dropdown>
      </el-header>
      <el-main class="layout-main"><router-view /></el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Odometer, User, UserFilled, List, Promotion, ChatDotRound } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const titles: Record<string, string> = { '/': '数据看板', '/customers': '客户列表', '/tags': '标签管理', '/channels': '渠道管理', '/message-templates': '消息模板', '/notifications': '通知中心', '/sop': 'SOP 管理', '/sop/executions': '执行记录', '/mass-task': '群发任务' };
const pageTitle = computed(() => titles[route.path] || 'SCRM 运营平台');

function handleCmd(cmd: string) { if (cmd === 'logout') { authStore.logout(); router.push('/login'); } }
</script>

<style scoped>
.layout-container { height: 100vh; }
.layout-aside { background: #0f172a; overflow: hidden; }
.logo { height: 64px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #1e293b; }
.logo h2 { color: #fff; font-size: 18px; margin: 0; letter-spacing: 2px; }
.layout-header { background: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); z-index: 1; }
.page-title { font-size: 16px; font-weight: 600; color: #303133; }
.user-info { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.uname { font-size: 14px; color: #606266; }
.layout-main { background: #f5f7fa; padding: 20px; }
</style>
