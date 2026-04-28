<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
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

    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>
            <span>聚合看板（analytics-service / daily_stat）</span>
            <span style="font-size:12px;color:#909399;margin-left:8px">与「客户总数」等 OLTP 卡片独立；先跑日聚合再读当日快照</span>
          </template>
          <el-descriptions v-if="analyticsOverview" :column="4" border size="small">
            <el-descriptions-item label="统计日">{{ analyticsDate }}</el-descriptions-item>
            <el-descriptions-item label="累计客户（日表）">{{ analyticsOverview.totalCustomerCount }}</el-descriptions-item>
            <el-descriptions-item label="活跃客户（日表）">{{ analyticsOverview.activeCustomerCount }}</el-descriptions-item>
            <el-descriptions-item label="当日发送消息">{{ analyticsOverview.messageSendCount }}</el-descriptions-item>
            <el-descriptions-item label="SOP 执行（当日）">{{ analyticsOverview.sopExecuteCount }}</el-descriptions-item>
            <el-descriptions-item label="消息成功率%">{{ analyticsOverview.messageSuccessRate }}</el-descriptions-item>
            <el-descriptions-item label="SOP 成功率%">{{ analyticsOverview.sopSuccessRate }}</el-descriptions-item>
          </el-descriptions>
          <div v-else style="color:#c0c4cc;font-size:13px">暂无聚合数据（可检查网关与 analytics-service）</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="12">
        <el-card><template #header>客户来源分布</template>
          <v-chart :option="sourceOption" style="height:300px" autoresize />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card><template #header>客户状态分布</template>
          <v-chart :option="statusOption" style="height:300px" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="16">
        <el-card>
          <template #header>SOP 执行概览</template>
          <el-table :data="sopData" stripe size="small">
            <el-table-column prop="templateName" label="SOP名称" />
            <el-table-column prop="templateType" label="类型" width="100">
              <template #default="{ row }"><el-tag size="small">{{ row.templateType === 1 ? '客户SOP' : '群SOP' }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '草稿' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>快速操作</template>
          <div class="quick-actions">
            <el-button type="primary" @click="$router.push('/customers')"><el-icon><User /></el-icon> 客户管理</el-button>
            <el-button type="success" @click="$router.push('/sop/create')"><el-icon><Plus /></el-icon> 新建 SOP</el-button>
            <el-button type="warning" @click="$router.push('/sop/executions')"><el-icon><VideoPlay /></el-icon> 执行记录</el-button>
            <el-button @click="$router.push('/tags')"><el-icon><PriceTag /></el-icon> 标签管理</el-button>
          </div>
        </el-card>

        <el-card style="margin-top:20px">
          <template #header>标签统计</template>
          <div v-for="tag in tagStats" :key="tag.id" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0">
            <el-tag :color="tag.tagColor || '#409EFF'" style="color:#fff" size="small">{{ tag.tagName }}</el-tag>
            <span style="color:#909399;font-size:12px">{{ tagTypeMap[tag.tagType] || '其他' }}</span>
          </div>
          <div v-if="tagStats.length === 0" style="text-align:center;padding:20px;color:#c0c4cc">暂无标签</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart, BarChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent } from 'echarts/components';
import { User, Plus, VideoPlay, PriceTag, UserFilled, TrendCharts, ChatDotRound, DataAnalysis } from '@element-plus/icons-vue';
import api from '@/utils/api';

use([CanvasRenderer, PieChart, BarChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent]);

const statCards = ref([
  { label: '客户总数', value: '-', icon: UserFilled, color: '#4caf50', bg: '#e8f5e9' },
  { label: '活跃客户', value: '-', icon: TrendCharts, color: '#2196f3', bg: '#e3f2fd' },
  { label: 'SOP 模板', value: '-', icon: ChatDotRound, color: '#ff9800', bg: '#fff3e0' },
  { label: '执行中', value: '-', icon: DataAnalysis, color: '#e91e63', bg: '#fce4ec' },
]);

const sourceOption = ref<any>({});
const statusOption = ref<any>({});
const sopData = ref<any[]>([]);
const tagStats = ref<any[]>([]);
const tagTypeMap: Record<number, string> = { 1: '来源', 2: '行为', 3: '兴趣', 4: '价值' };

/** 本地日历日 YYYY-MM-DD（与 analytics 聚合 stat_date 对齐） */
function localYmd(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const analyticsDate = ref(localYmd());
const analyticsOverview = ref<{
  totalCustomerCount: number;
  activeCustomerCount: number;
  messageSendCount: number;
  messageSuccessRate: number;
  sopExecuteCount: number;
  sopSuccessRate: number;
} | null>(null);

async function loadStats() {
  try {
    const [custRes, sopRes, execRes, tagRes] = await Promise.allSettled([
      api.get('/api/v1/customers/statistics/overview'),
      api.get('/api/sop/templates'),
      api.get('/api/sop/executions'),
      api.get('/api/v1/tags'),
    ]);

    if (custRes.status === 'fulfilled') {
      const d = custRes.value.data;
      statCards.value[0].value = String(d.total || 0);
      statCards.value[1].value = String(d.active || 0);
    }
    if (sopRes.status === 'fulfilled') {
      const d = sopRes.value.data;
      const items = d?.list || d?.items || [];
      statCards.value[2].value = String(items.length);
      sopData.value = items;
    }
    if (execRes.status === 'fulfilled') {
      const d = execRes.value.data;
      const items = d?.list || d?.items || [];
      const running = items.filter((e: any) => e.status === 0).length;
      statCards.value[3].value = String(running);
    }
    if (tagRes.status === 'fulfilled') {
      const d = tagRes.value.data;
      tagStats.value = d?.list || d?.items || (Array.isArray(d) ? d : []);
    }
  } catch {}
}

async function loadCharts() {
  try {
    const res = await api.get('/api/v1/customers', { params: { pageSize: 100 } });
    const customers = res.data?.list || res.data?.items || [];

    const channelCount: Record<string, number> = {};
    const statusCount: Record<string, number> = {};
    const channelLabels: Record<string, string> = { douyin: '抖音', xiaohongshu: '小红书', wechat: '微信', offline: '线下' };
    const statusLabels: Record<number, string> = { 0: '已流失', 1: '正常', 2: '待跟进' };

    for (const c of customers) {
      const ch = channelLabels[c.channel] || c.channel || '未知';
      channelCount[ch] = (channelCount[ch] || 0) + 1;
      const st = statusLabels[c.status] ?? '未知';
      statusCount[st] = (statusCount[st] || 0) + 1;
    }

    sourceOption.value = {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie', radius: ['40%', '70%'],
        data: Object.entries(channelCount).map(([name, value]) => ({ name, value })),
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' } },
      }],
    };

    const statusColors: Record<string, string> = { '正常': '#67C23A', '待跟进': '#E6A23C', '已流失': '#F56C6C' };
    statusOption.value = {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie', radius: ['40%', '70%'],
        data: Object.entries(statusCount).map(([name, value]) => ({
          name, value, itemStyle: { color: statusColors[name] || '#909399' },
        })),
      }],
    };
  } catch {}
}

/** Sprint 4：拉取经网关的 daily_stat 概览（先触发当日聚合，再读 overview） */
async function loadAnalyticsOverview() {
  const day = localYmd();
  analyticsDate.value = day;
  try {
    await api.post('/api/v1/analytics/jobs/aggregate-daily', { statDate: day });
  } catch {
    /* 聚合失败时仍尝试读已有日表 */
  }
  try {
    const res = await api.get('/api/v1/analytics/overview', { params: { date: day } });
    const d = res.data as Record<string, unknown>;
    if (d && typeof d.totalCustomerCount === 'number') {
      analyticsOverview.value = {
        totalCustomerCount: Number(d.totalCustomerCount),
        activeCustomerCount: Number(d.activeCustomerCount),
        messageSendCount: Number(d.messageSendCount),
        messageSuccessRate: Number(d.messageSuccessRate),
        sopExecuteCount: Number(d.sopExecuteCount),
        sopSuccessRate: Number(d.sopSuccessRate),
      };
    }
  } catch {
    analyticsOverview.value = null;
  }
}

onMounted(() => {
  loadStats();
  loadCharts();
  loadAnalyticsOverview();
});
</script>

<style scoped>
.stat-card { cursor: default; }
.stat-content { display: flex; align-items: center; gap: 16px; }
.stat-icon { width: 56px; height: 56px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; line-height: 1; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
.quick-actions { display: flex; flex-direction: column; gap: 12px; }
.quick-actions .el-button { width: 100%; justify-content: flex-start; }
</style>
