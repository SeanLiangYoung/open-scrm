<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>标签管理</span>
        <el-button type="primary" :disabled="submitting" @click="showCreate"
          ><el-icon><Plus /></el-icon> 新建标签</el-button
        >
      </div>
    </template>

    <el-table v-loading="loading" :data="tags" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="tagName" label="标签名" width="150">
        <template #default="{ row }">
          <el-tag
            :color="row.tagColor || row.color || '#409EFF'"
            style="color: #fff"
            size="small"
            >{{ row.tagName || row.name }}</el-tag
          >
        </template>
      </el-table-column>
      <el-table-column prop="tagType" label="类型" width="120">
        <template #default="{ row }">
          <el-tag size="small">{{ tagTypeLabel(row.tagType || row.tag_type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="isAuto" label="自动标签" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.isAuto || row.is_auto ? 'success' : 'info'">{{
            row.isAuto || row.is_auto ? '自动' : '手动'
          }}</el-tag>
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

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑标签' : '新建标签'"
      width="420px"
      :show-close="!submitting"
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
    >
      <el-form :model="form" label-width="80px" :disabled="submitting">
        <el-form-item label="标签名"><el-input v-model="form.name" :maxlength="50" /></el-form-item>
        <el-form-item v-if="editingId" label="父级标签"
          ><span>{{ parentLabel }}（保留，不修改层级）</span></el-form-item
        >
        <el-form-item label="颜色">
          <el-color-picker v-model="form.color" color-format="hex" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="submitting" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import type { Tag } from '@/types/view-models';
import { errorMessage } from '@/utils/error-message';
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '@/utils/api';
import { safeStaffNumber } from '@/composables/useTenantStaff';

const loading = ref(false);
const submitting = ref(false);
type ManagedTag = Tag & { parentId?: number | string };
const tags = ref<ManagedTag[]>([]);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const form = reactive({ name: '', color: '#409EFF' });
const originalParent = ref<number | string | undefined>();
const parentLabel = computed(() =>
  originalParent.value === undefined
    ? '未提供'
    : Number(originalParent.value) === 0
      ? '根标签'
      : tags.value.find(tag => String(tag.id) === String(originalParent.value))?.tagName ||
        `#${originalParent.value}`
);
let latestRead = 0;
function validTagId(value: unknown) {
  const id = safeStaffNumber(value);
  return id !== null && id <= 2147483647 ? id : null;
}

const formatDate = (d: string) => (d ? new Date(d).toLocaleString('zh-CN') : '-');
const tagTypeLabel = (t: number) => ({ 1: '来源', 2: '行为', 3: '兴趣', 4: '价值' })[t] || '其他';

async function fetchTags() {
  const request = ++latestRead;
  loading.value = true;
  try {
    const res = await api.get('/api/v1/tags');
    if (request !== latestRead) return;
    const data = res.data;
    tags.value = data?.list || data?.items || (Array.isArray(data) ? data : []);
  } catch {
    if (request === latestRead) ElMessage.error('获取标签列表失败');
  } finally {
    if (request === latestRead) loading.value = false;
  }
}

function showCreate() {
  if (submitting.value) return;
  editingId.value = null;
  Object.assign(form, { name: '', color: '#409EFF' });
  originalParent.value = undefined;
  dialogVisible.value = true;
}

function editTag(row: ManagedTag) {
  if (submitting.value) return;
  const id = validTagId(row.id);
  if (id === null) {
    ElMessage.warning('标签编号超出支持范围');
    return;
  }
  editingId.value = id;
  originalParent.value = row.parentId;
  Object.assign(form, {
    name: row.tagName || row.name,
    color: row.tagColor || row.color || ''
  });
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (submitting.value) return;
  if (!form.name.trim()) {
    ElMessage.warning('请输入标签名');
    return;
  }
  if (form.color && !/^#[0-9A-Fa-f]{6}$/.test(form.color)) {
    ElMessage.warning('请选择有效颜色');
    return;
  }
  submitting.value = true;
  try {
    const data = {
      tagName: form.name.trim(),
      ...(form.color ? { tagColor: form.color } : editingId.value ? { tagColor: null } : {})
    };
    if (editingId.value) await api.put(`/api/v1/tags/${editingId.value}`, data);
    else await api.post('/api/v1/tags', data);
    ElMessage.success(editingId.value ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    fetchTags();
  } catch (e: unknown) {
    ElMessage.error(errorMessage(e, '操作失败'));
  } finally {
    submitting.value = false;
  }
}

async function deleteTag(row: Tag) {
  const id = validTagId(row.id);
  if (id === null) {
    ElMessage.warning('标签编号超出支持范围');
    return;
  }
  try {
    await ElMessageBox.confirm(`确定删除标签 ${row.tagName || row.name}？`, '提示', {
      type: 'warning'
    });
    await api.delete(`/api/v1/tags/${id}`);
    ElMessage.success('删除成功');
    fetchTags();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(errorMessage(error, '删除失败'));
  }
}

onMounted(fetchTags);
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
