<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col v-for="card in statCards" :key="card.label" :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" :style="{ background: card.bg }">
              <el-icon :size="28" :color="card.color"><component :is="card.icon" /></el-icon>
            </div>
            <div>
              <div class="stat-value">{{ card.value }}</div>
              <div class="stat-label">{{ card.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card>
          <template #header>系统概览</template>
          <div class="welcome-content">
            <h3>欢迎使用 SCRM 管理平台</h3>
            <p>
              Open SCRM
              是一个开源的企业级私域运营系统，支持多渠道获客、智能化运营、数据分析等全链路功能。
            </p>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="系统版本">v1.0.0</el-descriptions-item>
              <el-descriptions-item label="当前用户">{{
                authStore.user?.username
              }}</el-descriptions-item>
              <el-descriptions-item label="后端服务">10 个微服务</el-descriptions-item>
              <el-descriptions-item label="运行状态"
                ><el-tag type="success">正常运行</el-tag></el-descriptions-item
              >
              <el-descriptions-item label="客户总数"
                >{{ customerStats.total }} 人</el-descriptions-item
              >
              <el-descriptions-item label="活跃客户"
                >{{ customerStats.active }} 人</el-descriptions-item
              >
            </el-descriptions>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>快速操作</template>
          <div class="quick-actions">
            <el-button type="primary" @click="$router.push('/users')"
              ><el-icon><User /></el-icon> 用户管理</el-button
            >
            <el-button type="success" @click="$router.push('/roles')"
              ><el-icon><Key /></el-icon> 角色管理</el-button
            >
            <el-button type="warning" @click="$router.push('/monitor')"
              ><el-icon><Monitor /></el-icon> 服务监控</el-button
            >
            <el-button @click="$router.push('/settings')"
              ><el-icon><Setting /></el-icon> 系统设置</el-button
            >
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  User,
  Key,
  Monitor,
  Setting,
  UserFilled,
  TrendCharts,
  ChatDotRound,
  DataAnalysis
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';

const authStore = useAuthStore();

const statCards = ref([
  { label: '系统用户', value: '-', icon: UserFilled, color: '#4caf50', bg: '#e8f5e9' },
  { label: '客户总数', value: '-', icon: TrendCharts, color: '#2196f3', bg: '#e3f2fd' },
  { label: 'SOP 模板', value: '-', icon: ChatDotRound, color: '#ff9800', bg: '#fff3e0' },
  { label: '标签数量', value: '-', icon: DataAnalysis, color: '#e91e63', bg: '#fce4ec' }
]);

const customerStats = ref({ total: 0, active: 0 });

async function loadDashboard() {
  try {
    const [usersRes, custRes, sopRes, tagsRes] = await Promise.allSettled([
      api.get('/api/v1/users/', { params: { pageSize: 1 } }),
      api.get('/api/v1/customers/statistics/overview'),
      api.get('/api/sop/templates'),
      api.get('/api/v1/tags')
    ]);

    if (usersRes.status === 'fulfilled')
      statCards.value[0].value = String(usersRes.value.data?.total || 0);
    if (custRes.status === 'fulfilled') {
      const d = custRes.value.data;
      statCards.value[1].value = String(d?.total || 0);
      customerStats.value = { total: d?.total || 0, active: d?.active || 0 };
    }
    if (sopRes.status === 'fulfilled') {
      const d = sopRes.value.data;
      statCards.value[2].value = String(d?.total || (d?.list || []).length);
    }
    if (tagsRes.status === 'fulfilled') {
      const d = tagsRes.value.data;
      const items = d?.list || d?.items || (Array.isArray(d) ? d : []);
      statCards.value[3].value = String(items.length);
    }
  } catch {
    // Preserve available cards if a malformed response prevents dashboard rendering.
  }
}

onMounted(loadDashboard);
</script>

<style scoped>
.stat-card {
  cursor: default;
}
.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}
.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  line-height: 1;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
.welcome-content h3 {
  margin: 0 0 12px;
  color: #303133;
}
.welcome-content p {
  color: #606266;
  margin-bottom: 20px;
  line-height: 1.6;
}
.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.quick-actions .el-button {
  width: 100%;
  justify-content: flex-start;
}
</style>
