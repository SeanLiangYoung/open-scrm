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

    <el-card data-testid="observed-trends" style="margin-top: 20px">
      <template #header>
        <span>日表记录趋势</span>
        <el-select
          v-model="trendDays"
          style="width: 130px; margin-left: 16px"
          @change="loadObservedTrends"
        >
          <el-option v-for="days in [7, 14, 30]" :key="days" :label="`近${days}日`" :value="days" />
        </el-select>
      </template>
      <p>按既存统计日，事件边界时区未记录；消息日志含模拟/历史结果，不代表第三方送达。</p>
      <p>库存为采集时快照，不是历史日末状态；缺测断线，不补零或沿用前日库存。</p>
      <el-alert v-if="trendError" :title="trendError" type="error" :closable="false" />
      <p v-if="trendError && observedTrend">以下为上次成功读取的数据，可能已过期。</p>
      <p v-if="trendLoading">正在读取日表…</p>
      <template v-if="observedTrend">
        <p>缺失 {{ observedTrend.points.filter(point => !point.observed).length }} 天观测</p>
        <p v-if="!observedTrend.points.some(point => point.observed)">所选区间无已存日表</p>
        <h3>每日创建记录</h3>
        <v-chart :option="eventTrendOption" style="height: 280px" autoresize />
        <h3>库存采集快照</h3>
        <v-chart :option="inventoryTrendOption" style="height: 280px" autoresize />
        <el-table :data="observedTrend.points" size="small" stripe>
          <el-table-column prop="date" label="统计日" min-width="105" />
          <el-table-column label="观测" min-width="80"
            ><template #default="{ row }">{{
              row.observed ? '已存日表' : '未观测'
            }}</template></el-table-column
          >
          <el-table-column
            v-for="metric in eventMetrics"
            :key="metric.key"
            :label="metric.label"
            min-width="110"
            ><template #default="{ row }">{{
              trendValue(row.events[metric.key])
            }}</template></el-table-column
          >
          <el-table-column
            v-for="metric in inventoryMetrics"
            :key="metric.key"
            :label="metric.label"
            min-width="105"
            ><template #default="{ row }">{{
              trendValue(row.inventory[metric.key])
            }}</template></el-table-column
          >
          <el-table-column label="实际采集时间" min-width="180"
            ><template #default="{ row }">{{
              row.observed
                ? row.snapshotObservedAt
                  ? snapshotTimeLabel(row.snapshotObservedAt)
                  : '采集时间未记录'
                : '未观测'
            }}</template></el-table-column
          >
        </el-table>
      </template>
    </el-card>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>
            <span>聚合看板（analytics-service / daily_stat）</span>
            <span style="font-size: 12px; color: #909399; margin-left: 8px"
              >与「客户总数」等实时业务卡片独立；只读已存当日快照，未采集时不自动补写</span
            >
          </template>
          <el-descriptions v-if="analyticsOverview" :column="4" border size="small">
            <el-descriptions-item label="统计日">{{ analyticsDate }}</el-descriptions-item>
            <el-descriptions-item label="累计客户（日表）">{{
              analyticsOverview.totalCustomerCount
            }}</el-descriptions-item>
            <el-descriptions-item label="快照采集时间">{{
              snapshotTimeLabel(analyticsOverview.snapshotObservedAt)
            }}</el-descriptions-item>
            <el-descriptions-item label="正常状态客户（日表快照）">{{
              analyticsOverview.normalCustomerCount
            }}</el-descriptions-item>
            <el-descriptions-item label="当日发送消息">{{
              analyticsOverview.messageSendCount
            }}</el-descriptions-item>
            <el-descriptions-item label="SOP 执行（当日）">{{
              analyticsOverview.sopExecuteCount
            }}</el-descriptions-item>
            <el-descriptions-item label="消息成功率%">{{
              analyticsOverview.messageSuccessRate
            }}</el-descriptions-item>
            <el-descriptions-item label="SOP 成功率%">{{
              analyticsOverview.sopSuccessRate
            }}</el-descriptions-item>
          </el-descriptions>
          <div
            v-else-if="analyticsSnapshotAvailable === false"
            style="color: #909399; font-size: 13px"
          >
            当日尚无聚合快照
          </div>
          <div v-else style="color: #c0c4cc; font-size: 13px">
            暂无聚合数据（可检查网关与 analytics-service）
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card
          ><template #header>客户来源分布（最近最多100位客户样本）</template>
          <v-chart :option="sourceOption" style="height: 300px" autoresize />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card
          ><template #header>客户状态分布（最近最多100位客户样本）</template>
          <v-chart :option="statusOption" style="height: 300px" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card>
          <template #header>SOP 执行概览</template>
          <el-table :data="sopData" stripe size="small">
            <el-table-column prop="templateName" label="SOP名称" />
            <el-table-column prop="templateType" label="类型" width="100">
              <template #default="{ row }"
                ><el-tag size="small">{{
                  row.templateType === 1 ? '客户SOP' : '群SOP'
                }}</el-tag></template
              >
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{
                  row.status === 1 ? '启用' : '草稿'
                }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>快速操作</template>
          <div class="quick-actions">
            <el-button type="primary" @click="$router.push('/customers')"
              ><el-icon><User /></el-icon> 客户管理</el-button
            >
            <el-button type="success" @click="$router.push('/sop/create')"
              ><el-icon><Plus /></el-icon> 新建 SOP</el-button
            >
            <el-button type="warning" @click="$router.push('/sop/executions')"
              ><el-icon><VideoPlay /></el-icon> 执行记录</el-button
            >
            <el-button @click="$router.push('/tags')"
              ><el-icon><PriceTag /></el-icon> 标签管理</el-button
            >
          </div>
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header>标签统计</template>
          <div
            v-for="tag in tagStats"
            :key="tag.id"
            style="
              display: flex;
              justify-content: space-between;
              padding: 6px 0;
              border-bottom: 1px solid #f0f0f0;
            "
          >
            <el-tag :color="tag.tagColor || '#409EFF'" style="color: #fff" size="small">{{
              tag.tagName
            }}</el-tag>
            <span style="color: #909399; font-size: 12px">{{
              tagTypeMap[tag.tagType] || '其他'
            }}</span>
          </div>
          <div
            v-if="tagStats.length === 0"
            style="text-align: center; padding: 20px; color: #c0c4cc"
          >
            暂无标签
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import type { SopTemplate, Tag } from '@/types/view-models';
import type { EChartsOption } from 'echarts';
import { ref, onMounted, computed } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart, BarChart, LineChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
} from 'echarts/components';
import {
  User,
  Plus,
  VideoPlay,
  PriceTag,
  UserFilled,
  TrendCharts,
  ChatDotRound,
  DataAnalysis
} from '@element-plus/icons-vue';
import api from '@/utils/api';
import { ElMessage } from 'element-plus';

use([
  CanvasRenderer,
  PieChart,
  BarChart,
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
]);

const statCards = ref([
  { label: '客户总数', value: '-', icon: UserFilled, color: '#4caf50', bg: '#e8f5e9' },
  { label: '正常状态客户', value: '-', icon: TrendCharts, color: '#2196f3', bg: '#e3f2fd' },
  { label: 'SOP 模板', value: '-', icon: ChatDotRound, color: '#ff9800', bg: '#fff3e0' },
  { label: '执行中', value: '-', icon: DataAnalysis, color: '#e91e63', bg: '#fce4ec' }
]);

const sourceOption = ref<EChartsOption>({});
const statusOption = ref<EChartsOption>({});
const sopData = ref<SopTemplate[]>([]);
const tagStats = ref<Tag[]>([]);
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
const analyticsSnapshotAvailable = ref<boolean | null>(null);
const analyticsOverview = ref<{
  totalCustomerCount: number;
  snapshotObservedAt: string | null;
  normalCustomerCount: number;
  messageSendCount: number;
  messageSuccessRate: number;
  sopExecuteCount: number;
  sopSuccessRate: number;
} | null>(null);

function snapshotTimeLabel(value: string | null): string {
  if (!value) return '未提供';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN') : '未提供';
}

async function loadStats() {
  try {
    const [custRes, sopRes, execRes, tagRes] = await Promise.allSettled([
      api.get('/api/v1/customers/statistics/overview'),
      api.get('/api/sop/templates'),
      api.get('/api/sop/executions', { params: { status: 0, pageSize: 1 } }),
      api.get('/api/v1/tags')
    ]);

    if (custRes.status === 'fulfilled') {
      const d = custRes.value.data;
      statCards.value[0].value = String(d.total || 0);
      statCards.value[1].value = String(d.active || 0);
    }
    if (sopRes.status === 'fulfilled') {
      const d = sopRes.value.data;
      const items = d?.list || d?.items || [];
      statCards.value[2].value = typeof d.total === 'number' ? String(d.total) : '-';
      sopData.value = items;
    }
    if (execRes.status === 'fulfilled') {
      const d = execRes.value.data;
      statCards.value[3].value = typeof d.total === 'number' ? String(d.total) : '-';
    }
    if (tagRes.status === 'fulfilled') {
      const d = tagRes.value.data;
      tagStats.value = d?.list || d?.items || (Array.isArray(d) ? d : []);
    }
    const failed = [custRes, sopRes, execRes, tagRes].flatMap((result, index) =>
      result.status === 'rejected' ? [['客户统计', 'SOP模板', '执行统计', '标签'][index]] : []
    );
    if (failed.length) ElMessage.error(`部分看板数据加载失败：${failed.join('、')}`);
  } catch {
    ElMessage.error('获取看板数据失败');
  }
}

async function loadCharts() {
  try {
    const res = await api.get('/api/v1/customers', { params: { pageSize: 100 } });
    const customers = res.data?.list || res.data?.items || [];

    const channelCount: Record<string, number> = {};
    const statusCount: Record<string, number> = {};
    const channelLabels: Record<string, string> = {
      douyin: '抖音',
      xiaohongshu: '小红书',
      wechat: '微信',
      offline: '线下'
    };
    const statusLabels: Record<number, string> = { 0: '已删除', 1: '正常', 2: '流失' };

    for (const c of customers) {
      const ch = channelLabels[c.channel] || c.channel || '未知';
      channelCount[ch] = (channelCount[ch] || 0) + 1;
      const st = statusLabels[c.status] ?? '未知';
      statusCount[st] = (statusCount[st] || 0) + 1;
    }

    sourceOption.value = {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          data: Object.entries(channelCount).map(([name, value]) => ({ name, value })),
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' }
          }
        }
      ]
    };

    const statusColors: Record<string, string> = {
      正常: '#67C23A',
      流失: '#E6A23C',
      已删除: '#F56C6C'
    };
    statusOption.value = {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          data: Object.entries(statusCount).map(([name, value]) => ({
            name,
            value,
            itemStyle: { color: statusColors[name] || '#909399' }
          }))
        }
      ]
    };
  } catch {
    ElMessage.error('获取客户图表失败');
  }
}

/** 只读取已存日表；页面访问不触发聚合写入。 */
async function loadAnalyticsOverview() {
  const day = localYmd();
  analyticsDate.value = day;
  try {
    const res = await api.get('/api/v1/analytics/overview', { params: { date: day } });
    const d = res.data as Record<string, unknown>;
    if (d?.snapshotAvailable === false) {
      analyticsSnapshotAvailable.value = false;
      analyticsOverview.value = null;
      return;
    }
    if (d && typeof d.totalCustomerCount === 'number') {
      analyticsSnapshotAvailable.value = true;
      analyticsOverview.value = {
        totalCustomerCount: Number(d.totalCustomerCount),
        snapshotObservedAt: typeof d.snapshotObservedAt === 'string' ? d.snapshotObservedAt : null,
        normalCustomerCount: Number(d.normalCustomerCount),
        messageSendCount: Number(d.messageSendCount),
        messageSuccessRate: Number(d.messageSuccessRate),
        sopExecuteCount: Number(d.sopExecuteCount),
        sopSuccessRate: Number(d.sopSuccessRate)
      };
    }
  } catch {
    analyticsOverview.value = null;
    analyticsSnapshotAvailable.value = null;
  }
}

type EventKey = 'newCustomerRecords' | 'messageLogRecords' | 'sopExecutionRecords';
type InventoryKey = 'totalCustomers' | 'normalCustomers' | 'deletedCustomers';
type ObservedPoint = {
  date: string;
  observed: boolean;
  snapshotObservedAt: string | null;
  events: Record<EventKey, number | null>;
  inventory: Record<InventoryKey, number | null>;
};
type ObservedTrend = {
  startDate: string;
  endDate: string;
  dateBasis: 'stored_daily_stat_date';
  eventDayTimezone: null;
  points: ObservedPoint[];
};
const eventMetrics: { key: EventKey; label: string }[] = [
  { key: 'newCustomerRecords', label: '新增客户记录数' },
  { key: 'messageLogRecords', label: '消息日志创建数' },
  { key: 'sopExecutionRecords', label: 'SOP执行创建数' }
];
const inventoryMetrics: { key: InventoryKey; label: string }[] = [
  { key: 'totalCustomers', label: '客户总库存' },
  { key: 'normalCustomers', label: '正常状态库存' },
  { key: 'deletedCustomers', label: '已删除库存' }
];
const trendDays = ref(7);
const observedTrend = ref<ObservedTrend | null>(null);
const trendError = ref('');
const trendLoading = ref(false);
let trendRead = 0;
function trendValue(value: number | null): string {
  return value === null ? '未观测' : String(value);
}
function chartOption(kind: 'events' | 'inventory'): EChartsOption {
  const points = observedTrend.value?.points || [];
  const metrics = kind === 'events' ? eventMetrics : inventoryMetrics;
  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const first = Array.isArray(params) ? params[0] : params;
        const index =
          first && typeof first === 'object' && 'dataIndex' in first ? Number(first.dataIndex) : -1;
        const point = points[index];
        if (!point) return '';
        const time = point.observed
          ? point.snapshotObservedAt
            ? snapshotTimeLabel(point.snapshotObservedAt)
            : '采集时间未记录'
          : '未观测';
        const values = metrics.map(
          metric =>
            `${metric.label}：${trendValue(kind === 'events' ? point.events[metric.key as EventKey] : point.inventory[metric.key as InventoryKey])}`
        );
        return [
          point.date,
          point.observed ? '已存日表' : '未观测',
          `实际采集时间：${time}`,
          ...values
        ].join('<br/>');
      }
    },
    legend: { data: metrics.map(metric => metric.label) },
    grid: { left: 55, right: 25, bottom: 35 },
    xAxis: { type: 'category', data: points.map(point => point.date) },
    yAxis: { type: 'value', min: 0, minInterval: 1 },
    series: metrics.map(metric => ({
      name: metric.label,
      type: 'line',
      connectNulls: false,
      data: points.map(point =>
        kind === 'events'
          ? point.events[metric.key as EventKey]
          : point.inventory[metric.key as InventoryKey]
      )
    }))
  };
}
const eventTrendOption = computed(() => chartOption('events'));
const inventoryTrendOption = computed(() => chartOption('inventory'));
async function loadObservedTrends() {
  const read = ++trendRead;
  const endDate = localYmd();
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const startDate = new Date(end - (trendDays.value - 1) * 86_400_000).toISOString().slice(0, 10);
  trendLoading.value = true;
  trendError.value = '';
  try {
    const response = await api.get<ObservedTrend>('/api/v1/analytics/observed-daily', {
      params: { startDate, endDate }
    });
    if (read !== trendRead) return;
    const data = response.data;
    if (
      !data ||
      data.startDate !== startDate ||
      data.endDate !== endDate ||
      data.dateBasis !== 'stored_daily_stat_date' ||
      data.eventDayTimezone !== null ||
      !Array.isArray(data.points) ||
      data.points.length !== trendDays.value
    )
      throw new Error('趋势响应无效');
    observedTrend.value = data;
  } catch (error: unknown) {
    if (read !== trendRead) return;
    const responseError = error as { response?: { data?: { message?: string } }; message?: string };
    trendError.value =
      responseError.response?.data?.message || responseError.message || '趋势读取失败';
  } finally {
    if (read === trendRead) trendLoading.value = false;
  }
}

onMounted(() => {
  loadStats();
  loadCharts();
  loadAnalyticsOverview();
  loadObservedTrends();
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
