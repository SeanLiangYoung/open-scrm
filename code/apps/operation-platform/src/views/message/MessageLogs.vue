<template>
  <el-card>
    <template #header>
      <div class="logs-header">
        <h2>消息日志</h2>
        <el-button :loading="loading" @click="loadLogs">刷新</el-button>
      </div>
    </template>
    <el-alert
      title="日志状态包含历史占位/模拟结果，不代表第三方送达。仅失败的模拟消息可手动重试。"
      type="info"
      :closable="false"
      show-icon
      class="logs-notice"
    />
    <el-form inline>
      <el-form-item label="发送状态">
        <el-select
          v-model="sendStatus"
          placeholder="全部状态"
          clearable
          style="width: 160px"
          @change="changeFilter"
        >
          <el-option label="待处理" :value="0" />
          <el-option label="记录成功" :value="1" />
          <el-option label="记录失败" :value="2" />
        </el-select>
      </el-form-item>
      <el-form-item label="消息渠道">
        <el-select
          v-model="messageType"
          placeholder="全部渠道"
          clearable
          style="width: 180px"
          @change="changeFilter"
        >
          <el-option label="企业微信" :value="1" />
          <el-option label="旧站内消息" :value="2" />
          <el-option label="短信" :value="3" />
          <el-option label="邮件" :value="4" />
          <el-option label="模拟" :value="5" />
        </el-select>
      </el-form-item>
    </el-form>
    <el-alert
      v-if="listError"
      :title="listError"
      type="error"
      :closable="false"
      class="logs-notice"
    />
    <el-alert
      v-if="retryFeedback"
      :title="retryFeedback.message"
      :type="retryFeedback.type"
      :closable="false"
      class="logs-notice"
    />
    <el-table
      v-loading="loading"
      :data="logs"
      stripe
      :empty-text="listError ? '加载失败' : '暂无消息日志'"
    >
      <el-table-column type="expand">
        <template #default="{ row }">
          <el-descriptions :column="2" border class="log-detail">
            <el-descriptions-item label="日志编号">{{ row.id }}</el-descriptions-item>
            <el-descriptions-item label="处理时间">{{
              formatDate(row.sendTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="完整内容" :span="2">
              <pre>{{ row.content }}</pre>
            </el-descriptions-item>
            <el-descriptions-item label="扩展信息" :span="2">
              <pre>{{ formatExtra(row.extra) }}</pre>
            </el-descriptions-item>
          </el-descriptions>
        </template>
      </el-table-column>
      <el-table-column prop="id" label="编号" width="90" />
      <el-table-column label="渠道" min-width="135"
        ><template #default="{ row }">{{
          channelLabel(row.messageType)
        }}</template></el-table-column
      >
      <el-table-column label="接收目标" min-width="115"
        ><template #default="{ row }">{{ targetLabel(row) }}</template></el-table-column
      >
      <el-table-column prop="content" label="内容" min-width="180" show-overflow-tooltip />
      <el-table-column label="日志状态" width="110"
        ><template #default="{ row }"
          ><el-tag :type="statusType(row.sendStatus)">{{
            statusLabel(row.sendStatus)
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column
        prop="failReason"
        label="最近失败原因"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column prop="retryCount" label="重试次数" width="90" />
      <el-table-column label="创建时间" min-width="170"
        ><template #default="{ row }">{{ formatDate(row.createTime) }}</template></el-table-column
      >
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="canRetry(row)"
            size="small"
            type="warning"
            :disabled="safeLogNumber(row.id) === null || retryingId !== null"
            :loading="retryingId === String(row.id)"
            :title="
              safeLogNumber(row.id) === null ? '编号无法安全提交' : '只执行模拟，不会真实送达'
            "
            @click="retryLog(row)"
            >重试模拟消息</el-button
          >
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="total, prev, pager, next"
      class="logs-pagination"
      @current-change="loadLogs"
    />
  </el-card>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { errorMessage } from '@/utils/error-message';

interface MessageLog {
  id: string | number;
  messageType: number;
  targetType: number;
  targetId: string | number;
  targetName?: string | null;
  content: string;
  sendStatus: number;
  failReason?: string | null;
  retryCount: number;
  createTime: string;
  sendTime?: string | null;
  extra?: unknown;
}
interface LogPage {
  list: MessageLog[];
  total: number;
}
interface Feedback {
  type: 'success' | 'warning' | 'error';
  message: string;
}
const logs = ref<MessageLog[]>([]);
const loading = ref(false);
const listError = ref('');
const retryFeedback = ref<Feedback | null>(null);
const retryingId = ref<string | null>(null);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const sendStatus = ref<number>();
const messageType = ref<number>();
let latestRead = 0;

const statusLabel = (status: number) => ['待处理', '记录成功', '记录失败'][status] || '未知状态';
const statusType = (status: number) => (['info', 'success', 'danger'] as const)[status] || 'info';
function channelLabel(type: number): string {
  if (type === 5) return '模拟（不会真实送达）';
  const label: Record<number, string> = { 1: '企业微信', 2: '旧站内消息', 3: '短信', 4: '邮件' };
  return `${label[type] || '未知渠道'}（尚未接通）`;
}
function targetLabel(log: MessageLog): string {
  const label: Record<number, string> = { 1: '客户', 2: '员工', 3: '群' };
  return log.targetName || `${label[log.targetType] || '目标'} #${log.targetId}`;
}
function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN') : '-';
}
function formatExtra(value: unknown): string {
  return value == null ? '-' : JSON.stringify(value, null, 2);
}
function safeLogNumber(value: unknown): number | null {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)))
    return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
const canRetry = (log: MessageLog) => log.messageType === 5 && log.sendStatus === 2;

async function loadLogs() {
  const read = ++latestRead;
  loading.value = true;
  listError.value = '';
  try {
    const result = await api.get<LogPage>('/api/message/logs', {
      params: {
        page: page.value,
        pageSize,
        ...(sendStatus.value === undefined ? {} : { sendStatus: sendStatus.value }),
        ...(messageType.value === undefined ? {} : { messageType: messageType.value })
      }
    });
    if (read !== latestRead) return;
    if (
      !Array.isArray(result.data.list) ||
      !Number.isSafeInteger(result.data.total) ||
      result.data.total < 0
    )
      throw new Error('Invalid message log response');
    logs.value = result.data.list;
    total.value = result.data.total;
  } catch (error: unknown) {
    if (read !== latestRead) return;
    listError.value = errorMessage(error, '获取消息日志失败');
  } finally {
    if (read === latestRead) loading.value = false;
  }
}
function changeFilter() {
  page.value = 1;
  loadLogs();
}
function retryResult(value: unknown, id: number): Feedback {
  const unknown: Feedback = { type: 'warning', message: '重试结果未确认，请刷新日志' };
  if (!value || typeof value !== 'object') return unknown;
  const result = value as Record<string, unknown>;
  if (!Array.isArray(result.details)) return unknown;
  if (
    result.total === 0 &&
    result.success === 0 &&
    result.failed === 0 &&
    result.details.length === 0
  )
    return { type: 'warning', message: '未匹配到可重试记录，请刷新日志' };
  if (result.total !== 1 || result.details.length !== 1) return unknown;
  const detail: unknown = result.details[0];
  if (!detail || typeof detail !== 'object') return unknown;
  const row = detail as Record<string, unknown>;
  if (safeLogNumber(row.id) !== id) return unknown;
  if (result.success === 1 && result.failed === 0 && row.success === true)
    return { type: 'success', message: '模拟重试成功，不代表真实送达' };
  if (result.success === 0 && result.failed === 1 && row.success === false)
    return {
      type: 'error',
      message: `模拟重试失败：${typeof row.error === 'string' && row.error ? row.error : '后端未说明原因'}`
    };
  return unknown;
}
async function retryLog(log: MessageLog) {
  const id = safeLogNumber(log.id);
  if (!canRetry(log) || id === null || retryingId.value !== null) return;
  retryingId.value = String(log.id);
  retryFeedback.value = null;
  try {
    await ElMessageBox.confirm('仅重试本条模拟消息，不会真实送达。', '重试模拟消息', {
      type: 'warning',
      confirmButtonText: '确认重试',
      cancelButtonText: '取消'
    });
    const response = await api.post<unknown>('/api/message/retry', { logIds: [id] });
    retryFeedback.value = retryResult(response.data, id);
    await loadLogs();
  } catch (error: unknown) {
    if (error !== 'cancel' && error !== 'close')
      retryFeedback.value = { type: 'error', message: errorMessage(error, '模拟重试失败，请重试') };
  } finally {
    retryingId.value = null;
  }
}
onMounted(loadLogs);
</script>
<style scoped>
.logs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h2 {
  margin: 0;
  font-size: 18px;
}
.logs-notice {
  margin-bottom: 16px;
}
.logs-pagination {
  margin-top: 20px;
  justify-content: flex-end;
}
.log-detail {
  padding: 16px;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 0;
}
</style>
