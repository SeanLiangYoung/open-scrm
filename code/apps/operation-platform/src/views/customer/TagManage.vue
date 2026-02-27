<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>标签管理</span>
        <el-button type="primary" @click="showCreate"><el-icon><Plus /></el-icon> 新建标签</el-button>
      </div>
    </template>

    <el-table :data="tags" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="tagName" label="标签名" width="150">
        <template #default="{ row }">
          <el-tag :color="row.tagColor || row.color || '#409EFF'" style="color:#fff" size="small">{{ row.tagName || row.name }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="tagType" label="类型" width="120">
        <template #default="{ row }">
          <el-tag size="small">{{ tagTypeLabel(row.tagType || row.tag_type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="isAuto" label="自动标签" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="(row.isAuto || row.is_auto) ? 'success' : 'info'">{{ (row.isAuto || row.is_auto) ? '自动' : '手动' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="create_time" label="创建时间">
        <template #default="{ row }">{{ formatDate(row.create_time || row.createTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" @click="editTag(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteTag(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑标签' : '新建标签'" width="420px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="标签名"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="标签组"><el-input v-model="form.groupName" placeholder="如：意向度、渠道、等级" /></el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="form.color" />
        </el-form-item>
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
const tags = ref<any[]>([]);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const form = reactive({ name: '', groupName: '', color: '#409EFF' });

const formatDate = (d: string) => d ? new Date(d).toLocaleString('zh-CN') : '-';
const tagTypeLabel = (t: number) => ({ 1: '来源', 2: '行为', 3: '兴趣', 4: '价值' }[t] || '其他');

async function fetchTags() {
  loading.value = true;
  try {
    const res = await api.get('/api/v1/tags');
    const data = res.data;
    const items = data.items || data.data?.items || data.data || data;
    tags.value = Array.isArray(items) ? items : [];
  } catch { ElMessage.error('获取标签列表失败'); } finally { loading.value = false; }
}

function showCreate() { editingId.value = null; Object.assign(form, { name: '', groupName: '', color: '#409EFF' }); dialogVisible.value = true; }

function editTag(row: any) {
  editingId.value = row.id;
  Object.assign(form, { name: row.tagName || row.name, groupName: '', color: row.tagColor || row.color || '#409EFF' });
  dialogVisible.value = true;
}

async function handleSubmit() {
  submitting.value = true;
  try {
    const data = { tagName: form.name, tagColor: form.color, tagType: 1, corpId: 1 };
    if (editingId.value) await api.put(`/api/v1/tags/${editingId.value}`, data);
    else await api.post('/api/v1/tags', data);
    ElMessage.success(editingId.value ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    fetchTags();
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '操作失败'); } finally { submitting.value = false; }
}

async function deleteTag(row: any) {
  await ElMessageBox.confirm(`确定删除标签 ${row.name}？`, '提示', { type: 'warning' });
  try { await api.delete(`/api/v1/tags/${row.id}`); ElMessage.success('删除成功'); fetchTags(); } catch { ElMessage.error('删除失败'); }
}

onMounted(fetchTags);
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
