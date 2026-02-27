<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" :style="{ background: card.bg }">
              <el-icon :size="28" :color="card.color"><component :is="card.icon" /></el-icon>
            </div>
            <div><div class="stat-value">{{ card.value }}</div><div class="stat-label">{{ card.label }}</div></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="12">
        <el-card><template #header>客户增长趋势（近7天）</template>
          <v-chart :option="trendOption" style="height:300px" autoresize />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card><template #header>客户来源分布</template>
          <v-chart :option="sourceOption" style="height:300px" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="16">
        <el-card>
          <template #header>SOP 执行概览</template>
          <el-table :data="sopData" stripe>
            <el-table-column prop="name" label="SOP名称" />
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }"><el-tag size="small">{{ row.type === 'customer' ? '客户SOP' : '群SOP' }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : row.status === 0 ? 'info' : 'danger'" size="small">
                  {{ ['草稿','启用','停用'][row.status] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="execCount" label="执行次数" width="100" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>快速操作</template>
          <div class="quick-actions">
            <el-button type="primary" @click="$router.push('/customers')"><el-icon><User /></el-icon> 客户管理</el-button>
            <el-button type="success" @click="$router.push('/sop')"><el-icon><List /></el-icon> SOP 管理</el-button>
            <el-button type="warning" @click="$router.push('/mass-task')"><el-icon><Promotion /></el-icon> 群发任务</el-button>
            <el-button @click="$router.push('/tags')"><el-icon><PriceTag /></el-icon> 标签管理</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, PieChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent } from 'echarts/components';
import { User, List, Promotion, PriceTag, UserFilled, TrendCharts, ChatDotRound, DataAnalysis } from '@element-plus/icons-vue';

use([CanvasRenderer, LineChart, PieChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent]);

const statCards = ref([
  { label: '客户总数', value: 8, icon: UserFilled, color: '#4caf50', bg: '#e8f5e9' },
  { label: '今日新增', value: 2, icon: TrendCharts, color: '#2196f3', bg: '#e3f2fd' },
  { label: '活跃SOP', value: 2, icon: ChatDotRound, color: '#ff9800', bg: '#fff3e0' },
  { label: '待跟进', value: 3, icon: DataAnalysis, color: '#e91e63', bg: '#fce4ec' },
]);

const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const trendOption = ref({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: days },
  yAxis: { type: 'value' },
  series: [
    { name: '新增客户', type: 'line', data: [3, 5, 2, 8, 4, 6, 2], smooth: true, areaStyle: { opacity: 0.15 }, color: '#409EFF' },
    { name: '活跃客户', type: 'line', data: [12, 15, 10, 18, 14, 20, 16], smooth: true, areaStyle: { opacity: 0.15 }, color: '#67C23A' },
  ],
});

const sourceOption = ref({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0 },
  series: [{
    type: 'pie', radius: ['40%', '70%'],
    data: [
      { value: 3, name: '抖音', itemStyle: { color: '#409EFF' } },
      { value: 2, name: '小红书', itemStyle: { color: '#E6A23C' } },
      { value: 2, name: '微信', itemStyle: { color: '#67C23A' } },
      { value: 1, name: '线下', itemStyle: { color: '#909399' } },
    ],
  }],
});

const sopData = ref([
  { name: '新客欢迎SOP', type: 'customer', status: 1, execCount: 156 },
  { name: '7天跟进SOP', type: 'customer', status: 1, execCount: 89 },
  { name: '社群运营SOP', type: 'group', status: 0, execCount: 0 },
]);
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
