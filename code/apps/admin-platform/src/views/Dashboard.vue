<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #e8f5e9">
              <el-icon :size="28" color="#4caf50"><UserFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalCustomers }}</div>
              <div class="stat-label">客户总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #e3f2fd">
              <el-icon :size="28" color="#2196f3"><TrendCharts /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.todayNewCustomers }}</div>
              <div class="stat-label">今日新增</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #fff3e0">
              <el-icon :size="28" color="#ff9800"><ChatDotRound /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.activeSopCount }}</div>
              <div class="stat-label">活跃 SOP</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #fce4ec">
              <el-icon :size="28" color="#e91e63"><DataAnalysis /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.conversionRate }}%</div>
              <div class="stat-label">转化率</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card>
          <template #header>
            <span>系统概览</span>
          </template>
          <div class="welcome-content">
            <h3>欢迎使用 SCRM 管理平台</h3>
            <p>Open SCRM 是一个开源的企业级私域运营系统，支持多渠道获客、智能化运营、数据分析等全链路功能。</p>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="系统版本">v1.0.0</el-descriptions-item>
              <el-descriptions-item label="当前用户">{{ authStore.user?.username }}</el-descriptions-item>
              <el-descriptions-item label="后端服务">10 个微服务</el-descriptions-item>
              <el-descriptions-item label="运行状态">
                <el-tag type="success">正常运行</el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>快速操作</span>
          </template>
          <div class="quick-actions">
            <el-button type="primary" @click="$router.push('/users')">
              <el-icon><User /></el-icon>
              用户管理
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import {
  UserFilled,
  TrendCharts,
  ChatDotRound,
  DataAnalysis,
  User,
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

const stats = reactive({
  totalCustomers: 1280,
  todayNewCustomers: 56,
  activeSopCount: 12,
  conversionRate: 23.5,
});
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
