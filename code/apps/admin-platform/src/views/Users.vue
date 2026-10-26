<template>
  <div class="users-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button type="primary" @click="showCreateDialog">
            <el-icon><Plus /></el-icon>
            新建用户
          </el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="users" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="realName" label="姓名" width="120" />
        <el-table-column prop="mobile" label="手机号" width="140" />
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="isAdmin" label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isAdmin === 1 ? 'warning' : 'info'">
              {{ row.isAdmin === 1 ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="editUser(row)">编辑</el-button>
            <el-button
              size="small"
              type="danger"
              :disabled="row.isAdmin === 1"
              @click="deleteUser(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="fetchUsers"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item v-if="!editingId" label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item v-if="!editingId" label="密码">
          <el-input v-model="form.password" type="password" placeholder="请输入密码（至少8位）" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.realName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.mobile" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit"> 确定 </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '@/utils/api';
import { apiErrorMessage } from '@/utils/error';
import type { UserInfo, UserList } from '@/types/user';

const loading = ref(false);
const submitting = ref(false);
const users = ref<UserInfo[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const dialogVisible = ref(false);
const dialogTitle = ref('新建用户');
const editingId = ref<number | string | null>(null);

const form = reactive({
  username: '',
  password: '',
  realName: '',
  mobile: '',
  email: ''
});

async function fetchUsers() {
  loading.value = true;
  try {
    const res = await api.get<UserList>('/api/v1/users/', {
      params: { page: page.value, pageSize: pageSize.value }
    });
    users.value = res.data.items;
    total.value = res.data.total;
  } catch (err) {
    ElMessage.error('获取用户列表失败');
  } finally {
    loading.value = false;
  }
}

function showCreateDialog() {
  editingId.value = null;
  dialogTitle.value = '新建用户';
  Object.assign(form, {
    username: '',
    password: '',
    realName: '',
    mobile: '',
    email: ''
  });
  dialogVisible.value = true;
}

function editUser(row: UserInfo) {
  editingId.value = row.id;
  dialogTitle.value = '编辑用户';
  Object.assign(form, {
    realName: row.realName || '',
    mobile: row.mobile || '',
    email: row.email || ''
  });
  dialogVisible.value = true;
}

async function handleSubmit() {
  submitting.value = true;
  try {
    if (editingId.value) {
      await api.put(`/api/v1/users/${editingId.value}`, {
        realName: form.realName,
        mobile: form.mobile,
        email: form.email
      });
      ElMessage.success('更新成功');
    } else {
      await api.post('/api/v1/users/', {
        username: form.username,
        password: form.password,
        corpId: 1,
        realName: form.realName,
        mobile: form.mobile,
        email: form.email
      });
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    fetchUsers();
  } catch (err) {
    ElMessage.error(apiErrorMessage(err, '操作失败'));
  } finally {
    submitting.value = false;
  }
}

async function deleteUser(row: UserInfo) {
  await ElMessageBox.confirm(`确定删除用户 ${row.username}？`, '提示', {
    type: 'warning'
  });
  try {
    await api.delete(`/api/v1/users/${row.id}`);
    ElMessage.success('删除成功');
    fetchUsers();
  } catch (err) {
    ElMessage.error(apiErrorMessage(err, '删除失败'));
  }
}

onMounted(() => {
  fetchUsers();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
