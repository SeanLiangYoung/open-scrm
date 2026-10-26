<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <div>
            <span>通知中心</span>
            <el-badge :value="unreadCount" :hidden="unreadCount === 0" style="margin-left: 12px">
              <el-tag size="small" type="danger">未读</el-tag>
            </el-badge>
          </div>
          <div>
            <el-button size="small" :disabled="unreadCount === 0" @click="markAllRead"
              >全部已读</el-button
            >
            <el-button size="small" type="primary" :disabled="submitting" @click="showCreate"
              ><el-icon><Plus /></el-icon> 发送通知</el-button
            >
          </div>
        </div>
      </template>

      <el-select
        :model-value="readFilter"
        aria-label="通知状态"
        style="width: 150px; margin-bottom: 16px"
        @change="changeReadFilter"
      >
        <el-option label="全部" value="all" />
        <el-option label="未读" :value="0" />
        <el-option label="已读" :value="1" />
      </el-select>
      <el-table v-loading="loading" :data="notifications" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" min-width="180">
          <template #default="{ row }">
            <span :style="{ fontWeight: row.isRead ? 'normal' : 'bold' }">{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="notificationType" label="类型" width="100">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="notifyType(row.notificationType || row.notification_type)"
              >{{ notifyLabel(row.notificationType || row.notification_type) }}</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="isRead" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isRead ? 'info' : 'danger'" size="small">{{
              row.isRead ? '已读' : '未读'
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="时间" width="180">
          <template #default="{ row }">{{
            formatDate(row.createTime || row.create_time)
          }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button v-if="!row.isRead" size="small" @click="markRead(row.id)"
              >标记已读</el-button
            >
            <el-button size="small" type="danger" text @click="deleteNotify(row.id)"
              ><el-icon><Delete /></el-icon
            ></el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        style="margin-top: 16px"
        @current-change="changePage"
      />
    </el-card>

    <el-dialog
      v-model="createDialog"
      title="发送通知"
      width="500px"
      :show-close="!submitting"
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
    >
      <el-form :model="notifyForm" label-width="80px" :disabled="submitting">
        <el-form-item label="标题"><el-input v-model="notifyForm.title" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="notifyForm.notificationType" style="width: 100%">
            <el-option label="系统通知" :value="1" />
            <el-option label="任务提醒" :value="2" />
            <el-option label="客户动态" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容"
          ><el-input v-model="notifyForm.content" type="textarea" :rows="3"
        /></el-form-item>
        <el-form-item label="目标用户">
          <TenantStaffSelect
            v-model="notifyForm.userIds"
            multiple
            placeholder="搜索本企业接收员工"
          />
          <el-checkbox v-model="notifyForm.includeSelf">同时通知我</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="submitting" @click="createDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSendNotify">发送</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import type { Notification } from '@/types/view-models';
import { errorMessage } from '@/utils/error-message';
import { ref, reactive, onMounted } from 'vue';
import TenantStaffSelect from '@/components/TenantStaffSelect.vue';
import { numericStaffIds, safeStaffNumber } from '@/composables/useTenantStaff';
import { useAuthStore } from '@/stores/auth';
import { ElMessage } from 'element-plus';
import { Plus, Delete } from '@element-plus/icons-vue';
import api from '@/utils/api';

const loading = ref(false);
const submitting = ref(false);
const notifications = ref<Notification[]>([]);
const unreadCount = ref(0);
const createDialog = ref(false);
const currentPage = ref(1);
const pageSize = 20;
const total = ref(0);
type ReadFilter = 'all' | 0 | 1;
const readFilter = ref<ReadFilter>('all');
let latestRefresh = 0;
const authStore = useAuthStore();
const notifyForm = reactive({
  title: '',
  notificationType: 1,
  content: '',
  userIds: [] as string[],
  includeSelf: false
});

const NOTIFY_LABELS: Record<string, string> = {
  '1': '系统',
  '2': '任务',
  '3': '客户',
  system: '系统',
  task: '任务',
  customer: '客户'
};
const NOTIFY_TYPES: Record<string, '' | 'warning' | 'success' | 'info'> = {
  '1': '',
  '2': 'warning',
  '3': 'success',
  system: '',
  task: 'warning',
  customer: 'success'
};
const notifyLabel = (t: number | string) => NOTIFY_LABELS[String(t)] || '通知';
const notifyType = (t: number | string) => NOTIFY_TYPES[String(t)] || 'info';
const formatDate = (d: string) => (d ? new Date(d).toLocaleString('zh-CN') : '-');

function changePage(page: number) {
  void fetchNotifications(page);
}
function changeReadFilter(value: unknown) {
  if (value === 'all' || value === 0 || value === 1) void fetchNotifications(1, value);
}
async function fetchNotifications(
  page = currentPage.value,
  filter = readFilter.value,
  correcting = false
) {
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger((page - 1) * pageSize)) {
    ElMessage.warning('通知页码无效');
    return;
  }
  const request = ++latestRefresh;
  loading.value = true;
  try {
    const res = await api.get('/api/notification/list', {
      params: { page, pageSize, ...(filter !== 'all' ? { isRead: filter } : {}) }
    });
    if (request !== latestRefresh) return;
    const data = res.data;
    if (!Array.isArray(data?.list) || !Number.isSafeInteger(data.total) || data.total < 0) {
      ElMessage.error('通知列表响应无效，请重试');
      return;
    }
    const lastPage = Math.max(1, Math.ceil(data.total / pageSize));
    if (page > lastPage) {
      if (!correcting) await fetchNotifications(lastPage, filter, true);
      else ElMessage.error('通知列表已变化，请重试');
      return;
    }
    notifications.value = data.list;
    total.value = data.total;
    currentPage.value = page;
    readFilter.value = filter;
  } catch {
    if (request === latestRefresh) ElMessage.error('获取通知列表失败');
  } finally {
    if (request === latestRefresh) loading.value = false;
  }

  if (request !== latestRefresh) return;
  try {
    const res = await api.get('/api/notification/unread/count');
    if (request !== latestRefresh) return;
    unreadCount.value = typeof res.data === 'number' ? res.data : res.data?.count || 0;
  } catch {
    if (request === latestRefresh) ElMessage.error('未读数量加载失败，请重试');
  }
}

async function markRead(id: number | string) {
  const notificationId = safeStaffNumber(id);
  if (notificationId === null) {
    ElMessage.warning('通知编号超出支持范围');
    return;
  }
  try {
    await api.put('/api/notification/read', { notificationIds: [notificationId] });
    fetchNotifications();
  } catch {
    ElMessage.error('标记已读失败');
  }
}

async function markAllRead() {
  try {
    await api.put('/api/notification/read/all');
    ElMessage.success('全部标记为已读');
    fetchNotifications();
  } catch {
    ElMessage.error('全部标记已读失败');
  }
}

async function deleteNotify(id: number | string) {
  const notificationId = safeStaffNumber(id);
  if (notificationId === null) {
    ElMessage.warning('通知编号超出支持范围');
    return;
  }
  try {
    await api.delete(`/api/notification/${notificationId}`);
    ElMessage.success('删除成功');
    fetchNotifications();
  } catch {
    ElMessage.error('删除通知失败');
  }
}

function showCreate() {
  if (submitting.value) return;
  Object.assign(notifyForm, {
    title: '',
    notificationType: 1,
    content: '',
    userIds: [],
    includeSelf: false
  });
  createDialog.value = true;
}

async function handleSendNotify() {
  if (!notifyForm.title.trim()) {
    ElMessage.warning('请输入标题');
    return;
  }
  if (!notifyForm.content.trim()) {
    ElMessage.warning('请输入通知内容');
    return;
  }
  const selected = [
    ...notifyForm.userIds,
    ...(notifyForm.includeSelf ? [String(authStore.user?.id ?? '')] : [])
  ];
  const userIds = numericStaffIds(selected);
  if (userIds === null) {
    ElMessage.warning('员工编号超出支持范围，请重新选择员工');
    return;
  }
  if (userIds.length === 0) {
    ElMessage.warning('请选择至少一名接收员工');
    return;
  }
  if (submitting.value) return;
  submitting.value = true;
  try {
    await api.post('/api/notification', {
      userIds,
      notificationType: notifyForm.notificationType,
      title: notifyForm.title.trim(),
      content: notifyForm.content.trim()
    });
    ElMessage.success('通知已发送');
    createDialog.value = false;
    Object.assign(notifyForm, {
      title: '',
      notificationType: 1,
      content: '',
      userIds: [],
      includeSelf: false
    });
    fetchNotifications();
  } catch (e: unknown) {
    ElMessage.error(errorMessage(e, '发送失败'));
  } finally {
    submitting.value = false;
  }
}

onMounted(fetchNotifications);
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
