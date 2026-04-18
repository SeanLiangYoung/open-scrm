<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>微服务状态监控</span>
          <el-button type="primary" :loading="refreshing" @click="checkAll">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </div>
      </template>

      <el-table :data="services" stripe>
        <el-table-column prop="name" label="服务名称" width="180" />
        <el-table-column prop="port" label="端口" width="80" />
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ok' ? 'success' : row.status === 'checking' ? 'warning' : 'danger'" size="small">
              {{ row.status === 'ok' ? '运行中' : row.status === 'checking' ? '检查中...' : '未启动' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="responseTime" label="响应时间" width="120">
          <template #default="{ row }">
            <span v-if="row.responseTime >= 0">{{ row.responseTime }}ms</span>
            <span v-else style="color: #909399">-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 20px">
      <template #header>基础设施</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="PostgreSQL">
          <el-tag type="success" size="small">运行中</el-tag> localhost:5432
        </el-descriptions-item>
        <el-descriptions-item label="Redis">
          <el-tag type="success" size="small">运行中</el-tag> localhost:6379
        </el-descriptions-item>
        <el-descriptions-item label="Node.js 版本">v18+ LTS</el-descriptions-item>
        <el-descriptions-item label="系统版本">SCRM v1.0.0</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import api from '@/utils/api';

interface ServiceInfo {
  name: string;
  port: number;
  description: string;
  status: string;
  responseTime: number;
}

const refreshing = ref(false);
const services = ref<ServiceInfo[]>([
  { name: 'gateway-service', port: 7000, description: 'API 网关 — 路由转发、认证、限流', status: 'unknown', responseTime: -1 },
  { name: 'auth-service', port: 7001, description: '认证授权 — 用户管理、JWT签发', status: 'unknown', responseTime: -1 },
  { name: 'customer-service', port: 7002, description: '客户管理 — 客户信息、标签', status: 'unknown', responseTime: -1 },
  { name: 'acquisition-service', port: 7003, description: '获客服务 — 渠道活码、内容发布', status: 'unknown', responseTime: -1 },
  { name: 'operation-service', port: 7004, description: '客户运营 — SOP、群发', status: 'unknown', responseTime: -1 },
  { name: 'asset-service', port: 7005, description: '资产管理 — 素材、文件', status: 'unknown', responseTime: -1 },
  { name: 'analytics-service', port: 7006, description: '数据分析 — BI报表', status: 'unknown', responseTime: -1 },
  { name: 'integration-service', port: 7007, description: '第三方集成 — 企微/抖音/小红书', status: 'unknown', responseTime: -1 },
  { name: 'message-service', port: 7008, description: '消息推送 — 模板、通知', status: 'unknown', responseTime: -1 },
  { name: 'finance-service', port: 7009, description: '财务管理 — 订单、支付', status: 'unknown', responseTime: -1 },
]);

async function checkService(svc: ServiceInfo) {
  svc.status = 'checking';
  const start = Date.now();
  try {
    const res = await fetch(`/api/health-check?port=${svc.port}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      svc.status = 'ok';
      svc.responseTime = Date.now() - start;
    } else {
      svc.status = 'down';
      svc.responseTime = -1;
    }
  } catch {
    svc.status = 'down';
    svc.responseTime = -1;
  }
}

async function checkAll() {
  refreshing.value = true;
  for (const svc of services.value) {
    await checkService(svc);
  }
  refreshing.value = false;
}
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
