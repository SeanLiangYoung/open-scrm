<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>渠道活码管理</span>
          <el-button type="primary" @click="showCreate"
            ><el-icon><Plus /></el-icon> 新建活码</el-button
          >
        </div>
      </template>

      <el-table v-loading="loading" :data="channels" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="codeName" label="活码名称" min-width="150" />
        <el-table-column prop="channel" label="渠道" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="channelType(row.channel)">{{
              channelLabel(row.channel)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="scanCount" label="扫码次数" width="100">
          <template #default="{ row }">{{ row.scanCount || row.scan_count || 0 }}</template>
        </el-table-column>
        <el-table-column prop="addCount" label="添加次数" width="100">
          <template #default="{ row }">{{ row.addCount || row.add_count || 0 }}</template>
        </el-table-column>
        <el-table-column label="转化率" width="100">
          <template #default="{ row }"> {{ calcRate(row) }}% </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">{{
              row.status === 1 ? '启用' : '禁用'
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" @click="editChannel(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>平台账号管理</span>
          <el-button type="primary" @click="showAccountCreate"
            ><el-icon><Plus /></el-icon> 绑定账号</el-button
          >
        </div>
      </template>

      <el-table v-loading="accountLoading" :data="accounts" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="platform" label="平台" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="channelType(row.platform)">{{
              channelLabel(row.platform)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="accountName" label="账号名称" min-width="150">
          <template #default="{ row }">{{ row.accountName || row.account_name }}</template>
        </el-table-column>
        <el-table-column prop="followerCount" label="粉丝数" width="100">
          <template #default="{ row }">{{ row.followerCount || row.follower_count || 0 }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">{{
              row.status === 1 ? '正常' : '失效'
            }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="channelDialog" :title="editingId ? '编辑活码' : '新建活码'" width="480px">
      <el-form :model="channelForm" label-width="80px">
        <el-form-item label="活码名称"><el-input v-model="channelForm.name" /></el-form-item>
        <el-form-item label="渠道">
          <el-select v-model="channelForm.channel" style="width: 100%">
            <el-option label="抖音" value="douyin" /><el-option
              label="小红书"
              value="xiaohongshu"
            />
            <el-option label="微信" value="wechat" /><el-option label="线下" value="offline" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="channelDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleChannelSubmit"
          >确定</el-button
        >
      </template>
    </el-dialog>

    <el-dialog v-model="accountDialog" title="绑定平台账号" width="480px">
      <el-form :model="accountForm" label-width="80px">
        <el-form-item label="平台">
          <el-select v-model="accountForm.platform" style="width: 100%">
            <el-option label="抖音" value="douyin" /><el-option
              label="小红书"
              value="xiaohongshu"
            />
            <el-option label="微信公众号" value="wechat" />
          </el-select>
        </el-form-item>
        <el-form-item label="账号名称"
          ><el-input v-model="accountForm.accountName" placeholder="如: XX官方旗舰店"
        /></el-form-item>
        <el-form-item label="账号ID"
          ><el-input v-model="accountForm.accountId" placeholder="平台账号ID"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="accountDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAccountSubmit"
          >确定</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import type { TagProps } from 'element-plus';
import type { ChannelCode, PlatformAccount } from '@/types/view-models';
import { errorMessage } from '@/utils/error-message';
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '@/utils/api';

const loading = ref(false);
const accountLoading = ref(false);
const submitting = ref(false);
const channels = ref<ChannelCode[]>([]);
const accounts = ref<PlatformAccount[]>([]);
const channelDialog = ref(false);
const accountDialog = ref(false);
const editingId = ref<number | null>(null);
const channelForm = reactive({ name: '', channel: 'douyin' });
const accountForm = reactive({ platform: 'douyin', accountName: '', accountId: '' });

const channelLabel = (c: string) =>
  ({ douyin: '抖音', xiaohongshu: '小红书', wechat: '微信', offline: '线下' })[c] || c;
const channelType = (c: string) =>
  (
    ({ douyin: '', xiaohongshu: 'warning', wechat: 'success', offline: 'info' }) as Record<
      string,
      TagProps['type'] | ''
    >
  )[c] || '';
const calcRate = (row: ChannelCode) => {
  const scan = row.scanCount || row.scan_count || 0;
  const add = row.addCount || row.add_count || 0;
  return scan > 0 ? ((add / scan) * 100).toFixed(1) : '0.0';
};

async function fetchChannels() {
  loading.value = true;
  try {
    const res = await api.get('/api/v1/acquisition/channel-codes', {
      params: { page: 1, pageSize: 100 }
    });
    const data = res.data;
    channels.value = data?.list || data?.items || (Array.isArray(data) ? data : []);
  } catch {
    ElMessage.error('获取渠道活码失败');
  } finally {
    loading.value = false;
  }
}

async function fetchAccounts() {
  accountLoading.value = true;
  try {
    const res = await api.get('/api/platform-account/list');
    const data = res.data;
    accounts.value = data?.list || data?.items || (Array.isArray(data) ? data : []);
  } catch {
    ElMessage.error('获取平台账号失败');
  } finally {
    accountLoading.value = false;
  }
}

function showCreate() {
  editingId.value = null;
  Object.assign(channelForm, { name: '', channel: 'douyin' });
  channelDialog.value = true;
}
function editChannel(row: ChannelCode) {
  editingId.value = row.id;
  Object.assign(channelForm, { name: row.codeName || row.name, channel: row.channel });
  channelDialog.value = true;
}
function showAccountCreate() {
  Object.assign(accountForm, { platform: 'douyin', accountName: '', accountId: '' });
  accountDialog.value = true;
}

async function handleChannelSubmit() {
  submitting.value = true;
  try {
    if (editingId.value) {
      ElMessage.info('编辑接口暂未开放，请仅使用新建');
      return;
    }
    await api.post('/api/v1/acquisition/channel-codes', {
      codeName: channelForm.name,
      channel: channelForm.channel
    });
    ElMessage.success('操作成功');
    channelDialog.value = false;
    fetchChannels();
  } catch (e: unknown) {
    ElMessage.error(errorMessage(e, '操作失败'));
  } finally {
    submitting.value = false;
  }
}

async function handleAccountSubmit() {
  submitting.value = true;
  try {
    await api.post('/api/platform-account', { ...accountForm, corpId: 1 });
    ElMessage.success('绑定成功');
    accountDialog.value = false;
    fetchAccounts();
  } catch (e: unknown) {
    ElMessage.error(errorMessage(e, '操作失败'));
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  fetchChannels();
  fetchAccounts();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
