<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header"><span>角色管理</span></div>
      </template>
      <el-table v-loading="loading" :data="roles" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="roleName" label="角色名称" width="150">
          <template #default="{ row }">{{ row.roleName || row.role_name }}</template>
        </el-table-column>
        <el-table-column prop="roleCode" label="角色代码" width="150">
          <template #default="{ row }">
            <el-tag size="small">{{ row.roleCode || row.role_code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="createTime" label="创建时间" width="180">
          <template #default="{ row }">{{
            formatDate(row.createTime || row.create_time)
          }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 20px">
      <template #header><span>权限列表</span></template>
      <el-empty description="权限配置功能开发中" :image-size="80" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import type { RoleInfo, UserList } from '@/types/user';

const loading = ref(false);
const roles = ref<RoleInfo[]>([]);
const formatDate = (d?: string) => (d ? new Date(d).toLocaleString('zh-CN') : '-');

async function fetchRoles() {
  loading.value = true;
  try {
    const res = await api.get<UserList>('/api/v1/users/', { params: { page: 1, pageSize: 100 } });
    const users = res.data.items || [];
    const roleSet = new Map<number, RoleInfo>();
    for (const u of users) {
      if (u.roles) for (const r of u.roles) roleSet.set(r.id, r);
    }
    roles.value = Array.from(roleSet.values());
    if (roles.value.length === 0) {
      roles.value = [
        { id: 1, roleName: '超级管理员', roleCode: 'super_admin', description: '拥有所有权限' },
        { id: 2, roleName: '管理员', roleCode: 'admin', description: '管理企业和用户' },
        { id: 3, roleName: '运营人员', roleCode: 'operator', description: '运营客户和SOP' },
        { id: 4, roleName: '销售人员', roleCode: 'sales', description: '管理客户和跟进' },
        { id: 5, roleName: '查看者', roleCode: 'viewer', description: '只能查看数据' }
      ];
    }
  } catch {
    ElMessage.error('获取角色列表失败');
  } finally {
    loading.value = false;
  }
}

onMounted(fetchRoles);
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
