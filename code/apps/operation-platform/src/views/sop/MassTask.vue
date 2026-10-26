<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>群发任务</span>
        <el-button type="primary" @click="showCreate"
          ><el-icon><Plus /></el-icon> 新建群发</el-button
        >
      </div>
    </template>
    <el-alert
      title="当前仅支持模拟消息任务，不会真实发送消息。创建后需手动确认执行。"
      type="info"
      :closable="false"
      show-icon
    />
    <el-form inline class="filters" @submit.prevent="searchTasks">
      <el-form-item
        ><el-input v-model="filters.taskName" placeholder="按任务名称搜索" clearable
      /></el-form-item>
      <el-form-item>
        <el-select v-model="filters.status" placeholder="任务状态" clearable style="width: 140px">
          <el-option
            v-for="(label, status) in STATUS_LABELS"
            :key="status"
            :label="label"
            :value="Number(status)"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select
          v-model="filters.targetType"
          placeholder="目标类型"
          clearable
          style="width: 120px"
        >
          <el-option
            v-for="(label, type) in TARGET_LABELS"
            :key="type"
            :label="label"
            :value="Number(type)"
          />
        </el-select>
      </el-form-item>
      <el-form-item><el-button type="primary" native-type="submit">查询</el-button></el-form-item>
    </el-form>
    <el-table v-loading="loading" :data="tasks" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="taskName" label="任务名称" min-width="180" />
      <el-table-column label="目标" width="90"
        ><template #default="{ row }">{{
          TARGET_LABELS[row.targetType] || '未知'
        }}</template></el-table-column
      >
      <el-table-column prop="targetCount" label="目标数" width="90" />
      <el-table-column prop="successCount" label="成功数" width="90" />
      <el-table-column prop="failCount" label="失败数" width="90" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }"
          ><el-tag :type="taskStatusType(row.status)" size="small">{{
            STATUS_LABELS[row.status] || '未知'
          }}</el-tag></template
        >
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 0 && row.taskType === 1 && row.messageType === 5"
            size="small"
            type="primary"
            :disabled="actingTaskId !== null"
            @click="executeTask(row)"
            >执行</el-button
          >
          <el-button
            v-if="row.status === 0"
            size="small"
            type="warning"
            :disabled="actingTaskId !== null"
            @click="cancelTask(row)"
            >取消</el-button
          >
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="total > 0"
      v-model:current-page="page"
      :page-size="20"
      :total="total"
      layout="total, prev, pager, next"
      @current-change="fetchTasks"
    />
    <el-dialog v-model="dialogVisible" title="新建群发任务" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="任务名称" required
          ><el-input v-model="form.taskName" placeholder="任务名称" maxlength="100"
        /></el-form-item>
        <el-form-item label="目标类型">
          <el-radio-group v-model="form.targetType">
            <el-radio :value="1">客户</el-radio><el-radio :value="2">员工</el-radio
            ><el-radio :value="3">群</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="目标 ID" required
          ><el-input v-model="form.targetIds" placeholder="多个 ID 用逗号分隔"
        /></el-form-item>
        <el-form-item label="发送内容" required
          ><el-input
            v-model="form.messageContent"
            type="textarea"
            :rows="4"
            placeholder="输入群发消息内容"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import type { TagProps } from 'element-plus';
import type { MassTask } from '@/types/view-models';
import { errorMessage } from '@/utils/error-message';
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '@/utils/api';

interface MessageTask extends Omit<MassTask, 'id'> {
  id: number | string;
  messageType?: number;
}
const STATUS_LABELS: Record<number, string> = {
  0: '待执行',
  1: '执行中',
  2: '已完成',
  3: '已失败',
  4: '已取消'
};
const TARGET_LABELS: Record<number, string> = { 1: '客户', 2: '员工', 3: '群' };
const STATUS_TYPES: Record<number, TagProps['type']> = {
  0: 'info',
  1: 'warning',
  2: 'success',
  3: 'danger',
  4: 'info'
};
const taskStatusType = (status: number) => STATUS_TYPES[status] || 'info';
const loading = ref(false);
const submitting = ref(false);
const tasks = ref<MessageTask[]>([]);
const dialogVisible = ref(false);
const actingTaskId = ref<number | string | null>(null);
const page = ref(1);
const total = ref(0);
const filters = reactive<{ taskName: string; status?: number; targetType?: number }>({
  taskName: ''
});
const form = reactive({ taskName: '', targetType: 1, targetIds: '', messageContent: '' });

async function fetchTasks() {
  loading.value = true;
  try {
    const params: Record<string, string | number> = { page: page.value, pageSize: 20 };
    if (filters.taskName.trim()) params.taskName = filters.taskName.trim();
    if (typeof filters.status === 'number') params.status = filters.status;
    if (typeof filters.targetType === 'number') params.targetType = filters.targetType;
    const res = await api.get('/api/mass-task/list', { params });
    tasks.value = res.data.list;
    total.value = res.data.total;
  } catch (e: unknown) {
    ElMessage.error(errorMessage(e, '获取任务列表失败'));
  } finally {
    loading.value = false;
  }
}
function searchTasks() {
  page.value = 1;
  void fetchTasks();
}
function showCreate() {
  Object.assign(form, { taskName: '', targetType: 1, targetIds: '', messageContent: '' });
  dialogVisible.value = true;
}
async function handleCreate() {
  const taskName = form.taskName.trim();
  const messageContent = form.messageContent.trim();
  if (!taskName || !messageContent) {
    ElMessage.warning('请填写任务名称和发送内容');
    return;
  }
  const values = form.targetIds.trim().split(/[,，\s]+/);
  if (!values.every(value => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)))) {
    ElMessage.warning('请输入有效的正整数目标 ID');
    return;
  }
  submitting.value = true;
  try {
    await api.post('/api/mass-task', {
      taskName,
      taskType: 1,
      targetType: form.targetType,
      targetIds: [...new Set(values.map(Number))],
      messageContent,
      messageType: 5
    });
    ElMessage.success('模拟任务创建成功');
    dialogVisible.value = false;
    await fetchTasks();
  } catch (e: unknown) {
    ElMessage.error(errorMessage(e, '创建失败'));
  } finally {
    submitting.value = false;
  }
}
function parseTaskId(value: number | string): number | null {
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
async function executeTask(row: MessageTask) {
  const taskId = parseTaskId(row.id);
  if (taskId === null) {
    ElMessage.error('任务 ID 无效');
    return;
  }
  try {
    await ElMessageBox.confirm('确定执行此模拟任务？不会真实发送消息。', '模拟执行', {
      type: 'info',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  actingTaskId.value = row.id;
  try {
    await api.post('/api/mass-task/execute', { taskId });
    ElMessage.success('模拟任务执行完成');
    await fetchTasks();
  } catch (e: unknown) {
    ElMessage.error(errorMessage(e, '执行失败'));
  } finally {
    actingTaskId.value = null;
  }
}
async function cancelTask(row: MessageTask) {
  const taskId = parseTaskId(row.id);
  if (taskId === null) {
    ElMessage.error('任务 ID 无效');
    return;
  }
  actingTaskId.value = row.id;
  try {
    await api.post(`/api/mass-task/${taskId}/cancel`);
    ElMessage.success('已取消');
    await fetchTasks();
  } catch (e: unknown) {
    ElMessage.error(errorMessage(e, '取消失败'));
  } finally {
    actingTaskId.value = null;
  }
}
onMounted(fetchTasks);
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filters {
  margin-top: 20px;
}
.el-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
