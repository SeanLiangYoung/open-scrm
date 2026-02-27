<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>SOP 管理</span>
        <el-button type="primary" @click="$router.push('/sop/create')"><el-icon><Plus /></el-icon> 新建 SOP</el-button>
      </div>
    </template>

    <el-table :data="sopList" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="templateName" label="SOP 名称" min-width="180" />
      <el-table-column prop="templateType" label="类型" width="100">
        <template #default="{ row }"><el-tag size="small">{{ (row.templateType || row.type) === 1 || (row.templateType || row.type) === 'customer' ? '客户SOP' : '群SOP' }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="triggerType" label="触发方式" width="120">
        <template #default="{ row }">{{ triggerLabel(row.triggerType || row.trigger_type) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="$router.push(`/sop/${row.id}/edit`)">编辑</el-button>
          <el-button size="small" :type="row.status === 1 ? 'warning' : 'success'" @click="toggleStatus(row)">
            {{ row.status === 1 ? '停用' : '启用' }}
          </el-button>
          <el-button size="small" type="danger" @click="deleteSop(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '@/utils/api';

const loading = ref(false);
const sopList = ref<any[]>([]);

const triggerLabel = (t: any) => ({ 1: '添加好友', 2: '打标签', 3: '进群触发', 4: '手动触发', manual: '手动触发', auto: '自动触发', schedule: '定时触发' }[t] || String(t));
const statusLabel = (s: number) => ['草稿', '启用', '停用'][s] || '未知';
const statusType = (s: number): any => ['info', 'success', 'danger'][s] || 'info';

async function fetchSopList() {
  loading.value = true;
  try {
    const res = await api.get('/api/sop/templates');
    const data = res.data?.data || res.data;
    sopList.value = data?.list || data?.items || (Array.isArray(data) ? data : []);
  } catch { ElMessage.error('获取 SOP 列表失败'); } finally { loading.value = false; }
}

async function toggleStatus(row: any) {
  const newStatus = row.status === 1 ? 2 : 1;
  try {
    await api.put(`/api/sop/template/${row.id}`, { status: newStatus });
    ElMessage.success(newStatus === 1 ? '已启用' : '已停用');
    fetchSopList();
  } catch { ElMessage.error('操作失败'); }
}

async function deleteSop(row: any) {
  await ElMessageBox.confirm(`确定删除 SOP "${row.name}"？`, '提示', { type: 'warning' });
  try { await api.delete(`/api/sop/template/${row.id}`); ElMessage.success('删除成功'); fetchSopList(); } catch { ElMessage.error('删除失败'); }
}

onMounted(fetchSopList);
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
