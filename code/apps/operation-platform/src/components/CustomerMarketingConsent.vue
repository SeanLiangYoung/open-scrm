<template>
  <el-card style="margin-top: 20px">
    <template #header>营销授权证据</template>
    <p>仅登记客户已经作出的授权，请根据实际证据填写，不会自动取得客户同意。</p>
    <p class="consent-note">授权快照仅反映读取时的证据记录，不代表持续实时状态。</p>
    <el-form label-position="top" :model="draft">
      <el-form-item label="授权政策版本">
        <el-input
          v-model="draft.policyVersion"
          placeholder="填写实际授权政策版本"
          :maxlength="64"
        />
      </el-form-item>
      <el-form-item label="证据渠道">
        <el-select v-model="draft.channel" placeholder="证据渠道" style="width: 100%">
          <el-option
            v-for="channel in channels"
            :key="channel.value"
            :label="channel.label"
            :value="channel.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="语言地区">
        <el-input v-model="draft.locale" placeholder="例如 zh-CN" :maxlength="16" />
      </el-form-item>
    </el-form>
    <div class="consent-actions">
      <el-button type="primary" :loading="busy === 'grant'" :disabled="!!busy" @click="grant"
        >登记授权证据</el-button
      >
      <el-button type="warning" :loading="busy === 'revoke'" :disabled="!!busy" @click="revoke"
        >撤回营销授权</el-button
      >
    </div>
    <p v-if="result" data-testid="consent-operation-result" role="status">{{ result }}</p>
    <section aria-label="营销授权读取快照" class="consent-history">
      <div class="history-header">
        <h3>已登记的营销授权证据</h3>
        <el-button
          :loading="historyLoading"
          :disabled="!!busy"
          @click="loadHistory(history?.page || 1)"
          >刷新授权记录</el-button
        >
      </div>
      <el-alert v-if="historyError" :title="historyError" type="error" :closable="false" />
      <p v-if="historyStale && history">以下为上次读取快照，尚未确认最新状态。</p>
      <template v-if="history">
        <p>
          未撤回证据 {{ history.activeCount }} 条；已撤回 {{ history.revokedCount }} 条；共
          {{ history.total }} 条证据。
        </p>
        <p class="consent-note">
          读取时间：<time :datetime="history.observedAt" :title="history.observedAt">{{
            formatDate(history.observedAt)
          }}</time>
        </p>
        <el-table
          v-loading="historyLoading"
          :data="history.list"
          row-key="id"
          empty-text="尚无营销授权证据记录"
          stripe
        >
          <el-table-column prop="id" label="记录编号" min-width="125" />
          <el-table-column label="政策版本" min-width="130"
            ><template #default="{ row }">{{
              row.policyVersion ?? '未记录'
            }}</template></el-table-column
          >
          <el-table-column label="证据渠道" min-width="100"
            ><template #default="{ row }">{{ row.channel ?? '未记录' }}</template></el-table-column
          >
          <el-table-column label="语言地区" min-width="100"
            ><template #default="{ row }">{{ row.locale ?? '未记录' }}</template></el-table-column
          >
          <el-table-column label="登记时间" min-width="175"
            ><template #default="{ row }">{{
              formatDate(row.createdAt)
            }}</template></el-table-column
          >
          <el-table-column label="撤回时间" min-width="175"
            ><template #default="{ row }">{{
              row.revokedAt ? formatDate(row.revokedAt) : '尚未撤回'
            }}</template></el-table-column
          >
        </el-table>
        <el-pagination
          :current-page="history.page"
          :page-size="20"
          :total="history.total"
          layout="total, prev, pager, next"
          :disabled="!!busy"
          @current-change="loadHistory"
        />
      </template>
      <p v-else-if="historyLoading">正在读取授权记录…</p>
      <p v-else>尚未取得授权记录快照。</p>
    </section>
  </el-card>
</template>

<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { errorMessage } from '@/utils/error-message';

const props = defineProps<{ customerId: string | number }>();
const draft = reactive({ policyVersion: '', channel: '', locale: '' });
const busy = ref<'' | 'grant' | 'revoke'>('');
const result = ref('');
interface Evidence {
  id: string;
  purpose: 'marketing';
  policyVersion: string | null;
  channel: string | null;
  locale: string | null;
  createdAt: string;
  revokedAt: string | null;
}
interface History {
  customerId: string;
  purpose: 'marketing';
  observedAt: string;
  hasActiveMarketingConsent: boolean;
  activeCount: number;
  revokedCount: number;
  total: number;
  page: number;
  pageSize: number;
  list: Evidence[];
}
const history = ref<History | null>(null);
const historyLoading = ref(false);
const historyError = ref('');
const historyStale = ref(false);
let latestRead = 0;
let latestWrite = 0;
let disposed = false;
const formatDate = (value: string) =>
  new Date(value).toLocaleString('zh-CN', { timeZoneName: 'short' });
const iso = (value: unknown): value is string =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
function validHistory(value: unknown, customerId: number, page: number): value is History {
  if (!value || typeof value !== 'object') return false;
  const h = value as History;
  if (
    h.customerId !== String(customerId) ||
    h.purpose !== 'marketing' ||
    !iso(h.observedAt) ||
    h.page !== page ||
    h.pageSize !== 20 ||
    ![h.activeCount, h.revokedCount, h.total].every(n => Number.isSafeInteger(n) && n >= 0) ||
    h.activeCount + h.revokedCount !== h.total ||
    h.hasActiveMarketingConsent !== h.activeCount > 0 ||
    !Array.isArray(h.list) ||
    h.list.length > 20 ||
    h.list.length > h.total
  )
    return false;
  return h.list.every(
    row =>
      row &&
      typeof row.id === 'string' &&
      /^[1-9]\d*$/.test(row.id) &&
      row.purpose === 'marketing' &&
      [row.policyVersion, row.channel, row.locale].every(
        v => v === null || typeof v === 'string'
      ) &&
      iso(row.createdAt) &&
      (row.revokedAt === null || iso(row.revokedAt))
  );
}
function invalidateHistory() {
  latestRead++;
  historyLoading.value = false;
  historyStale.value = !!history.value;
}
async function loadHistory(page = 1) {
  const id = safeCustomerId(false);
  if (id === null) {
    historyError.value = '客户编号无效，无法读取授权记录';
    return;
  }
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return;
  const read = ++latestRead;
  historyLoading.value = true;
  historyError.value = '';
  try {
    const response = await api.get<unknown>(`/api/v1/messages/consents/customer/${id}`, {
      params: { page, pageSize: 20 }
    });
    if (disposed || read !== latestRead) return;
    if (!validHistory(response.data, id, page)) throw new Error('授权记录响应无效，请重试');
    history.value = response.data;
    historyStale.value = false;
  } catch (error: unknown) {
    if (disposed || read !== latestRead) return;
    historyError.value = errorMessage(error, '读取授权记录失败，请重试');
    historyStale.value = !!history.value;
  } finally {
    if (!disposed && read === latestRead) historyLoading.value = false;
  }
}
const channels = [
  { value: 'web', label: 'Web' },
  { value: 'line_oa', label: 'LINE OA' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: '其他' }
];
function safeCustomerId(notify = true): number | null {
  const raw = String(props.customerId);
  const id = Number(raw);
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(id)) {
    if (notify) ElMessage.warning('客户编号无效，无法提交授权操作');
    return null;
  }
  return id;
}
async function grant() {
  if (busy.value) return;
  const customerId = safeCustomerId();
  if (customerId === null) return;
  const policyVersion = draft.policyVersion.trim();
  const locale = draft.locale.trim();
  if (!policyVersion) return void ElMessage.warning('请填写实际授权政策版本');
  if (!draft.channel || !locale) return void ElMessage.warning('请选择实际证据渠道并填写语言地区');
  try {
    if (!Intl.getCanonicalLocales(locale).length) throw new Error('invalid locale');
  } catch {
    return void ElMessage.warning('语言地区格式无效');
  }
  busy.value = 'grant';
  const write = ++latestWrite;
  invalidateHistory();
  try {
    const response = await api.post('/api/v1/messages/consents/grant', {
      customerId,
      purpose: 'marketing',
      policyVersion,
      channel: draft.channel,
      locale
    });
    const evidence = response.data;
    if (disposed || write !== latestWrite) return;
    result.value = `本次登记：记录 ${evidence.id}，政策 ${evidence.policyVersion}，渠道 ${evidence.channel}，语言地区 ${evidence.locale}`;
    await loadHistory(1);
  } catch (error) {
    if (!disposed && write === latestWrite)
      ElMessage.error(errorMessage(error, '登记授权证据失败'));
  } finally {
    if (!disposed && write === latestWrite) busy.value = '';
  }
}
async function revoke() {
  if (busy.value) return;
  const customerId = safeCustomerId();
  if (customerId === null) return;
  busy.value = 'revoke';
  const write = ++latestWrite;
  invalidateHistory();
  try {
    const response = await api.post('/api/v1/messages/consents/revoke', {
      customerId,
      purpose: 'marketing'
    });
    if (disposed || write !== latestWrite) return;
    result.value = `本次撤回 ${response.data.revokedCount} 条营销授权记录`;
    await loadHistory(1);
  } catch (error) {
    if (!disposed && write === latestWrite)
      ElMessage.error(errorMessage(error, '撤回营销授权失败'));
  } finally {
    if (!disposed && write === latestWrite) busy.value = '';
  }
}
watch(
  () => props.customerId,
  () => {
    latestWrite++;
    invalidateHistory();
    history.value = null;
    historyError.value = '';
    historyStale.value = false;
    result.value = '';
    busy.value = '';
    Object.assign(draft, { policyVersion: '', channel: '', locale: '' });
    void loadHistory(1);
  },
  { immediate: true }
);
onBeforeUnmount(() => {
  disposed = true;
  latestRead++;
  latestWrite++;
});
</script>

<style scoped>
.consent-note {
  color: #606266;
  font-size: 13px;
}
.consent-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.consent-actions .el-button {
  margin-left: 0;
}
.consent-history {
  margin-top: 24px;
}
.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.history-header h3 {
  font-size: 16px;
}
.el-pagination {
  margin-top: 16px;
}
</style>
