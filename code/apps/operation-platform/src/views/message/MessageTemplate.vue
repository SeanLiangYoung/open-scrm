<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>消息模板</span>
        <el-button type="primary" @click="showCreate"><el-icon><Plus /></el-icon> 新建模板</el-button>
      </div>
    </template>

    <el-table :data="templates" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="templateName" label="模板名称" min-width="150">
        <template #default="{ row }">{{ row.templateName || row.template_name || row.name }}</template>
      </el-table-column>
      <el-table-column prop="templateType" label="类型" width="100">
        <template #default="{ row }">
          <el-tag size="small">{{ typeLabel(row.templateType || row.template_type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="content" label="内容预览" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">{{ row.content || '-' }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" @click="editTemplate(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteTemplate(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑模板' : '新建模板'" width="520px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="模板名称"><el-input v-model="form.templateName" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.templateType" style="width:100%">
            <el-option label="文本消息" :value="1" />
            <el-option label="图文消息" :value="2" />
            <el-option label="小程序" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="4" placeholder="消息内容，支持变量如 {{name}}" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
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
const templates = ref<any[]>([]);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const form = reactive({ templateName: '', templateType: 1, content: '' });

const typeLabel = (t: number) => ({ 1: '文本', 2: '图文', 3: '小程序' }[t] || '其他');

async function fetchTemplates() {
  loading.value = true;
  try {
    const res = await api.get('/api/message/templates');
    const data = res.data;
    templates.value = data?.list || data?.items || (Array.isArray(data) ? data : []);
  } catch {} finally { loading.value = false; }
}

function showCreate() { editingId.value = null; Object.assign(form, { templateName: '', templateType: 1, content: '' }); dialogVisible.value = true; }
function editTemplate(row: any) {
  editingId.value = row.id;
  Object.assign(form, { templateName: row.templateName || row.template_name || '', templateType: row.templateType || row.template_type || 1, content: row.content || '' });
  dialogVisible.value = true;
}

async function handleSubmit() {
  submitting.value = true;
  try {
    if (editingId.value) await api.put(`/api/message/template/${editingId.value}`, { ...form, corpId: 1 });
    else await api.post('/api/message/template', { ...form, corpId: 1 });
    ElMessage.success(editingId.value ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    fetchTemplates();
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '操作失败'); } finally { submitting.value = false; }
}

async function deleteTemplate(row: any) {
  await ElMessageBox.confirm(`确定删除模板 "${row.templateName || row.name}"？`, '提示', { type: 'warning' });
  try { await api.delete(`/api/message/template/${row.id}`); ElMessage.success('删除成功'); fetchTemplates(); } catch { ElMessage.error('删除失败'); }
}

onMounted(fetchTemplates);
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
