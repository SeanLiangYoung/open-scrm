<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <div>
            <span>通知中心</span>
            <el-badge :value="unreadCount" :hidden="unreadCount === 0" style="margin-left:12px">
              <el-tag size="small" type="danger">未读</el-tag>
            </el-badge>
          </div>
          <div>
            <el-button size="small" @click="markAllRead" :disabled="unreadCount === 0">全部已读</el-button>
            <el-button size="small" type="primary" @click="showCreate"><el-icon><Plus /></el-icon> 发送通知</el-button>
          </div>
        </div>
      </template>

      <el-table :data="notifications" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" min-width="180">
          <template #default="{ row }">
            <span :style="{ fontWeight: row.isRead ? 'normal' : 'bold' }">{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="notificationType" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="notifyType(row.notificationType || row.notification_type)">{{ notifyLabel(row.notificationType || row.notification_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="isRead" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isRead ? 'info' : 'danger'" size="small">{{ row.isRead ? '已读' : '未读' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createTime || row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" v-if="!row.isRead" @click="markRead(row.id)">标记已读</el-button>
            <el-button size="small" type="danger" text @click="deleteNotify(row.id)"><el-icon><Delete /></el-icon></el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialog" title="发送通知" width="500px">
      <el-form :model="notifyForm" label-width="80px">
        <el-form-item label="标题"><el-input v-model="notifyForm.title" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="notifyForm.notificationType" style="width:100%">
            <el-option label="系统通知" :value="1" />
            <el-option label="任务提醒" :value="2" />
            <el-option label="客户动态" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容"><el-input v-model="notifyForm.content" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="目标用户">
          <el-select v-model="notifyForm.userIds" style="width:100%" placeholder="选择接收用户">
            <el-option label="管理员 (ID:1)" :value="1" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSendNotify">发送</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Delete } from '@element-plus/icons-vue';
import api from '@/utils/api';

const loading = ref(false);
const submitting = ref(false);
const notifications = ref<any[]>([]);
const unreadCount = ref(0);
const createDialog = ref(false);
const notifyForm = reactive({ title: '', notificationType: 1, content: '', userIds: 1 });

const NOTIFY_LABELS: Record<string, string> = {
  '1': '系统',
  '2': '任务',
  '3': '客户',
  system: '系统',
  task: '任务',
  customer: '客户',
};
const NOTIFY_TYPES: Record<string, '' | 'warning' | 'success' | 'info'> = {
  '1': '',
  '2': 'warning',
  '3': 'success',
  system: '',
  task: 'warning',
  customer: 'success',
};
const notifyLabel = (t: number | string) => NOTIFY_LABELS[String(t)] || '通知';
const notifyType = (t: number | string) => NOTIFY_TYPES[String(t)] || 'info';
const formatDate = (d: string) => d ? new Date(d).toLocaleString('zh-CN') : '-';

async function fetchNotifications() {
  loading.value = true;
  try {
    const res = await api.get('/api/notification/list');
    const data = res.data;
    notifications.value = data?.list || data?.items || (Array.isArray(data) ? data : []);
  } catch {} finally { loading.value = false; }

  try {
    const res = await api.get('/api/notification/unread/count');
    unreadCount.value = typeof res.data === 'number' ? res.data : (res.data?.count || 0);
  } catch { unreadCount.value = 0; }
}

async function markRead(id: number) {
  try { await api.put('/api/notification/read', { notificationIds: [id] }); fetchNotifications(); } catch {}
}

async function markAllRead() {
  try { await api.put('/api/notification/read/all'); ElMessage.success('全部标记为已读'); fetchNotifications(); } catch {}
}

async function deleteNotify(id: number) {
  try { await api.delete(`/api/notification/${id}`); ElMessage.success('删除成功'); fetchNotifications(); } catch {}
}

function showCreate() { Object.assign(notifyForm, { title: '', notificationType: 1, content: '', userIds: 1 }); createDialog.value = true; }

async function handleSendNotify() {
  if (!notifyForm.title) { ElMessage.warning('请输入标题'); return; }
  submitting.value = true;
  try {
    await api.post('/api/notification', {
      userIds: notifyForm.userIds,
      notificationType: notifyForm.notificationType,
      title: notifyForm.title,
      content: notifyForm.content,
    });
    ElMessage.success('通知已发送');
    createDialog.value = false;
    fetchNotifications();
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '发送失败'); } finally { submitting.value = false; }
}

onMounted(fetchNotifications);
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
