<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>SOP 执行记录</span>
          <el-button type="primary" @click="showExecuteDialog"><el-icon><VideoPlay /></el-icon> 执行 SOP</el-button>
        </div>
      </template>

      <el-table :data="executions" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="templateName" label="SOP 名称" width="180" />
        <el-table-column prop="targetType" label="目标" width="80">
          <template #default="{ row }">{{ row.targetType === 1 ? '客户' : '群' }}</template>
        </el-table-column>
        <el-table-column prop="currentStep" label="进度" width="120">
          <template #default="{ row }">
            <el-progress :percentage="row.totalSteps ? Math.round(row.currentStep / row.totalSteps * 100) : 0" :status="progressStatus(row.status)" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="execStatusType(row.status)" size="small">{{ execStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="执行时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createTime || row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button size="small" v-if="row.status === 0" type="warning" @click="controlExec(row.id, 'pause')">暂停</el-button>
            <el-button size="small" v-if="row.status === 2" type="success" @click="controlExec(row.id, 'resume')">恢复</el-button>
            <el-button size="small" v-if="row.status === 0 || row.status === 2" type="danger" @click="controlExec(row.id, 'cancel')">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="execDialogVisible" title="执行 SOP" width="500px">
      <el-form label-width="100px">
        <el-form-item label="选择 SOP">
          <el-select v-model="execForm.templateId" style="width:100%" placeholder="选择要执行的 SOP 模板">
            <el-option v-for="t in templates" :key="t.id" :label="t.templateName" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标类型">
          <el-radio-group v-model="execForm.targetType">
            <el-radio :value="1">客户</el-radio>
            <el-radio :value="2">群</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="选择客户" v-if="execForm.targetType === 1">
          <el-select v-model="execForm.targetIds" multiple style="width:100%" placeholder="选择目标客户">
            <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="Number(c.id)" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="execDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="executing" @click="handleExecute">执行</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { VideoPlay } from '@element-plus/icons-vue';
import api from '@/utils/api';

const loading = ref(false);
const executing = ref(false);
const executions = ref<any[]>([]);
const templates = ref<any[]>([]);
const customers = ref<any[]>([]);
const execDialogVisible = ref(false);
const execForm = reactive({ templateId: null as number | null, targetType: 1, targetIds: [] as number[] });

const execStatusLabel = (s: number) => ['执行中', '已完成', '已暂停', '已失败'][s] || '未知';
const execStatusType = (s: number): any => ['', 'success', 'warning', 'danger'][s] || 'info';
const progressStatus = (s: number) => s === 1 ? 'success' : s === 3 ? 'exception' : undefined;
const formatDate = (d: string) => d ? new Date(d).toLocaleString('zh-CN') : '-';

async function fetchExecutions() {
  loading.value = true;
  try {
    const res = await api.get('/api/sop/executions');
    const data = res.data;
    executions.value = data?.list || data?.items || (Array.isArray(data) ? data : []);
  } catch { ElMessage.error('获取执行记录失败'); }
  finally { loading.value = false; }
}

async function fetchTemplates() {
  try {
    const res = await api.get('/api/sop/templates');
    const data = res.data;
    templates.value = (data?.list || data?.items || []).filter((t: any) => t.status === 1);
  } catch {}
}

async function fetchCustomers() {
  try {
    const res = await api.get('/api/v1/customers', { params: { pageSize: 100 } });
    const data = res.data;
    customers.value = data?.list || data?.items || [];
  } catch {}
}

function showExecuteDialog() {
  execForm.templateId = null;
  execForm.targetType = 1;
  execForm.targetIds = [];
  execDialogVisible.value = true;
}

async function handleExecute() {
  if (!execForm.templateId) { ElMessage.warning('请选择 SOP 模板'); return; }
  if (execForm.targetIds.length === 0) { ElMessage.warning('请选择目标客户'); return; }
  executing.value = true;
  try {
    await api.post('/api/sop/execute', {
      templateId: execForm.templateId,
      targetType: execForm.targetType,
      targetIds: execForm.targetIds,
    });
    ElMessage.success('SOP 已开始执行');
    execDialogVisible.value = false;
    fetchExecutions();
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '执行失败'); }
  finally { executing.value = false; }
}

async function controlExec(execId: number, action: string) {
  try {
    await api.post('/api/sop/execution/control', { executionIds: execId, action });
    ElMessage.success('操作成功');
    fetchExecutions();
  } catch { ElMessage.error('操作失败'); }
}

onMounted(() => { fetchExecutions(); fetchTemplates(); fetchCustomers(); });
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
