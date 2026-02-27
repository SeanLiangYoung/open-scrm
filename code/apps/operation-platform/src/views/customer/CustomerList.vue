<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-input v-model="keyword" placeholder="搜索客户名称/手机号" clearable style="width:240px" @clear="fetchCustomers" @keyup.enter="fetchCustomers">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-select v-model="statusFilter" placeholder="状态" clearable style="width:120px;margin-left:12px" @change="fetchCustomers">
              <el-option label="正常" :value="1" /><el-option label="待跟进" :value="2" /><el-option label="流失" :value="0" />
            </el-select>
          </div>
          <el-button type="primary" @click="showCreate"><el-icon><Plus /></el-icon> 新建客户</el-button>
        </div>
      </template>

      <el-table :data="customers" v-loading="loading" stripe @row-click="goDetail">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="客户名称" width="120" />
        <el-table-column prop="gender" label="性别" width="80">
          <template #default="{ row }">{{ ['未知','男','女'][row.gender] }}</template>
        </el-table-column>
        <el-table-column prop="mobile" label="手机号" width="140" />
        <el-table-column prop="channel" label="来源" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="sourceTagType(row.channel || row.source)">{{ sourceLabel(row.channel || row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="create_time" label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.create_time || row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click.stop="editCustomer(row)">编辑</el-button>
            <el-button size="small" type="danger" @click.stop="deleteCustomer(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total, prev, pager, next" @current-change="fetchCustomers" />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑客户' : '新建客户'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="姓名"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio :value="1">男</el-radio><el-radio :value="2">女</el-radio><el-radio :value="0">未知</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="手机号"><el-input v-model="form.mobile" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="来源">
          <el-select v-model="form.source" style="width:100%">
            <el-option label="抖音" value="douyin" /><el-option label="小红书" value="xiaohongshu" />
            <el-option label="微信" value="wechat" /><el-option label="线下" value="offline" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search } from '@element-plus/icons-vue';
import api from '@/utils/api';

const router = useRouter();
const loading = ref(false);
const submitting = ref(false);
const customers = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const keyword = ref('');
const statusFilter = ref<number | undefined>();
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const form = reactive({ name: '', gender: 0, mobile: '', email: '', source: 'wechat', remark: '' });

const sourceMap: Record<string, string> = { douyin: '抖音', xiaohongshu: '小红书', wechat: '微信', offline: '线下' };
const sourceLabel = (s: string) => sourceMap[s] || s;
const sourceTagType = (s: string): any => ({ douyin: '', xiaohongshu: 'warning', wechat: 'success', offline: 'info' }[s] || 'info');
const statusLabel = (s: number) => ['流失', '正常', '待跟进'][s] || '未知';
const statusType = (s: number): any => ['danger', 'success', 'warning'][s] || 'info';
const formatDate = (d: string) => d ? new Date(d).toLocaleString('zh-CN') : '-';

async function fetchCustomers() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (keyword.value) params.keyword = keyword.value;
    if (statusFilter.value !== undefined) params.status = statusFilter.value;
    const res = await api.get('/api/v1/customers', { params });
    const data = res.data;
    customers.value = data?.list || data?.items || (Array.isArray(data) ? data : []);
    total.value = data?.total || customers.value.length;
  } catch { ElMessage.error('获取客户列表失败'); } finally { loading.value = false; }
}

function goDetail(row: any) { router.push(`/customers/${row.id}`); }

function showCreate() {
  editingId.value = null;
  Object.assign(form, { name: '', gender: 0, mobile: '', email: '', source: 'wechat', remark: '' });
  dialogVisible.value = true;
}

function editCustomer(row: any) {
  editingId.value = row.id;
  Object.assign(form, { name: row.name, gender: row.gender, mobile: row.mobile || '', email: row.email || '', source: row.source || 'wechat', remark: row.remark || '' });
  dialogVisible.value = true;
}

async function handleSubmit() {
  submitting.value = true;
  try {
    const data: any = { ...form, corpId: 1 };
    if (!editingId.value) {
      data.externalUserid = `ext_${Date.now()}`;
      data.channel = form.source;
      data.followUserId = 1;
    }
    if (editingId.value) await api.put(`/api/v1/customers/${editingId.value}`, data);
    else await api.post('/api/v1/customers', data);
    ElMessage.success(editingId.value ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    fetchCustomers();
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '操作失败'); } finally { submitting.value = false; }
}

async function deleteCustomer(row: any) {
  await ElMessageBox.confirm(`确定删除客户 ${row.name}？`, '提示', { type: 'warning' });
  try { await api.delete(`/api/v1/customers/${row.id}`); ElMessage.success('删除成功'); fetchCustomers(); } catch { ElMessage.error('删除失败'); }
}

onMounted(fetchCustomers);
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; align-items: center; }
.pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
