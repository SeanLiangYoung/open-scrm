<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>群发任务</span>
        <el-button type="primary" @click="showCreate"><el-icon><Plus /></el-icon> 新建群发</el-button>
      </div>
    </template>

    <el-table :data="tasks" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="name" label="任务名称" min-width="180" />
      <el-table-column prop="target_type" label="目标" width="100">
        <template #default="{ row }">{{ (row.target_type || row.targetType) === 'customer' ? '客户' : '群' }}</template>
      </el-table-column>
      <el-table-column prop="target_count" label="目标数" width="90">
        <template #default="{ row }">{{ row.target_count ?? row.targetCount ?? 0 }}</template>
      </el-table-column>
      <el-table-column prop="sent_count" label="已发送" width="90">
        <template #default="{ row }">{{ row.sent_count ?? row.sentCount ?? 0 }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="taskStatusType(row.status)" size="small">{{ taskStatusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button size="small" type="primary" v-if="row.status === 'pending'" @click="executeTask(row)">执行</el-button>
          <el-button size="small" type="warning" v-if="row.status === 'running'" @click="cancelTask(row)">取消</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="新建群发任务" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="任务名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="目标类型">
          <el-radio-group v-model="form.targetType">
            <el-radio value="customer">客户</el-radio>
            <el-radio value="group">群</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="发送内容"><el-input v-model="form.content" type="textarea" :rows="4" placeholder="输入群发消息内容" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '@/utils/api';

const loading = ref(false);
const submitting = ref(false);
const tasks = ref<any[]>([]);
const dialogVisible = ref(false);
const form = reactive({ name: '', targetType: 'customer', content: '' });

const taskStatusLabel = (s: string) => ({ pending: '待执行', running: '执行中', completed: '已完成', cancelled: '已取消' }[s] || s);
const taskStatusType = (s: string): any => ({ pending: 'info', running: '', completed: 'success', cancelled: 'danger' }[s] || 'info');

async function fetchTasks() {
  loading.value = true;
  try {
    const res = await api.get('/api/mass-task/list');
    const data = res.data;
    tasks.value = data?.list || data?.items || (Array.isArray(data) ? data : []);
  } catch { ElMessage.error('获取任务列表失败'); } finally { loading.value = false; }
}

function showCreate() { Object.assign(form, { name: '', targetType: 'customer', content: '' }); dialogVisible.value = true; }

async function handleCreate() {
  submitting.value = true;
  try {
    await api.post('/api/mass-task', { ...form, corpId: 1, content: { text: form.content } });
    ElMessage.success('创建成功');
    dialogVisible.value = false;
    fetchTasks();
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '创建失败'); } finally { submitting.value = false; }
}

async function executeTask(row: any) {
  await ElMessageBox.confirm('确定执行此群发任务？', '提示', { type: 'info' });
  try { await api.post('/api/mass-task/execute', { taskId: row.id }); ElMessage.success('已开始执行'); fetchTasks(); } catch { ElMessage.error('执行失败'); }
}

async function cancelTask(row: any) {
  try { await api.post(`/api/mass-task/${row.id}/cancel`); ElMessage.success('已取消'); fetchTasks(); } catch { ElMessage.error('取消失败'); }
}

onMounted(fetchTasks);
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
