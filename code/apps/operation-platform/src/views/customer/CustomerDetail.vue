<template>
  <div v-loading="loading">
    <el-page-header @back="$router.push('/customers')" :content="`客户详情 - ${customer?.name || ''}`" style="margin-bottom:20px" />

    <el-row :gutter="20" v-if="customer">
      <el-col :span="16">
        <el-card>
          <template #header>基本信息</template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="客户名称">{{ customer.name }}</el-descriptions-item>
            <el-descriptions-item label="性别">{{ ['未知','男','女'][customer.gender] }}</el-descriptions-item>
            <el-descriptions-item label="手机号">{{ customer.mobile || '-' }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ customer.email || '-' }}</el-descriptions-item>
            <el-descriptions-item label="来源渠道">
              <el-tag size="small">{{ channelLabel(customer.channel) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="statusType(customer.status)" size="small">{{ statusLabel(customer.status) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间" :span="2">{{ formatDate(customer.createTime) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-top:20px">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span>客户标签</span>
              <el-button size="small" type="primary" @click="showTagDialog">添加标签</el-button>
            </div>
          </template>
          <div v-if="customer.tags && customer.tags.length">
            <el-tag v-for="tag in customer.tags" :key="tag.id" :color="tag.tagColor" closable style="margin:4px;color:#fff" @close="removeTag(tag.id)">{{ tag.tagName }}</el-tag>
          </div>
          <el-empty v-else description="暂无标签" :image-size="60" />
        </el-card>

        <el-card style="margin-top:20px">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span>跟进记录 ({{ followUps.length }})</span>
              <el-button size="small" type="primary" @click="showFollowUpDialog"><el-icon><Plus /></el-icon> 添加跟进</el-button>
            </div>
          </template>
          <el-timeline v-if="followUps.length > 0">
            <el-timeline-item v-for="f in followUps" :key="f.id" :timestamp="formatDate(f.createTime || f.create_time)" :type="followTypeColor(f.followType || f.follow_type)">
              <div>
                <el-tag size="small" :type="followTypeTag(f.followType || f.follow_type)" style="margin-right:8px">
                  {{ followTypeLabel(f.followType || f.follow_type) }}
                </el-tag>
                {{ f.content }}
              </div>
              <div v-if="f.nextFollowTime || f.next_follow_time" style="color:#909399;font-size:12px;margin-top:4px">
                下次跟进: {{ formatDate(f.nextFollowTime || f.next_follow_time) }}
              </div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无跟进记录" :image-size="60" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>快速操作</template>
          <div style="display:flex;flex-direction:column;gap:10px">
            <el-button type="primary" @click="showFollowUpDialog"><el-icon><Edit /></el-icon> 添加跟进</el-button>
            <el-button @click="showTagDialog"><el-icon><PriceTag /></el-icon> 管理标签</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="tagDialogVisible" title="添加标签" width="400px">
      <el-select v-model="selectedTagIds" multiple placeholder="选择标签" style="width:100%">
        <el-option v-for="t in allTags" :key="t.id" :label="t.tagName || t.name" :value="t.id" />
      </el-select>
      <template #footer>
        <el-button @click="tagDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="addTags">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="followUpDialog" title="添加跟进记录" width="500px">
      <el-form :model="followForm" label-width="100px">
        <el-form-item label="跟进方式">
          <el-select v-model="followForm.followType" style="width:100%">
            <el-option label="电话" :value="1" />
            <el-option label="微信" :value="2" />
            <el-option label="面访" :value="3" />
            <el-option label="其他" :value="4" />
          </el-select>
        </el-form-item>
        <el-form-item label="跟进内容">
          <el-input v-model="followForm.content" type="textarea" :rows="4" placeholder="记录跟进内容..." />
        </el-form-item>
        <el-form-item label="下次跟进">
          <el-date-picker v-model="followForm.nextFollowTime" type="datetime" placeholder="选择下次跟进时间" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="followUpDialog = false">取消</el-button>
        <el-button type="primary" :loading="followSubmitting" @click="handleAddFollowUp">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Plus, Edit, PriceTag } from '@element-plus/icons-vue';
import api from '@/utils/api';

const route = useRoute();
const loading = ref(true);
const customer = ref<any>(null);
const allTags = ref<any[]>([]);
const selectedTagIds = ref<number[]>([]);
const tagDialogVisible = ref(false);
const followUps = ref<any[]>([]);
const followUpDialog = ref(false);
const followSubmitting = ref(false);
const followForm = reactive({ followType: 2, content: '', nextFollowTime: null as Date | null });

const channelMap: Record<string, string> = { douyin: '抖音', xiaohongshu: '小红书', wechat: '微信', offline: '线下' };
const channelLabel = (c: string) => channelMap[c] || c || '-';
const statusLabel = (s: number) => ['已删除', '正常', '流失'][s] || '未知';
const statusType = (s: number): any => ['danger', 'success', 'warning'][s] || 'info';
const formatDate = (d: string) => d ? new Date(d).toLocaleString('zh-CN') : '-';
const followTypeLabel = (t: number) => ({ 1: '电话', 2: '微信', 3: '面访', 4: '其他' }[t] || '其他');
const followTypeColor = (t: number) => ({ 1: 'primary', 2: 'success', 3: 'warning', 4: '' }[t] || '');
const followTypeTag = (t: number): any => ({ 1: '', 2: 'success', 3: 'warning', 4: 'info' }[t] || 'info');

async function fetchDetail() {
  loading.value = true;
  try { const res = await api.get(`/api/v1/customers/${route.params.id}`); customer.value = res.data; } catch { ElMessage.error('获取客户详情失败'); } finally { loading.value = false; }
}

async function fetchTags() {
  try { const res = await api.get('/api/v1/tags'); const d = res.data; allTags.value = d?.list || d?.items || (Array.isArray(d) ? d : []); } catch {}
}

async function fetchFollowUps() {
  try {
    const res = await api.get(`/api/v1/follow-ups/customer/${route.params.id}`);
    const d = res.data;
    followUps.value = d?.list || d?.items || (Array.isArray(d) ? d : []);
  } catch {}
}

function showTagDialog() { selectedTagIds.value = []; tagDialogVisible.value = true; }
function showFollowUpDialog() { Object.assign(followForm, { followType: 2, content: '', nextFollowTime: null }); followUpDialog.value = true; }

async function addTags() {
  try {
    for (const tagId of selectedTagIds.value) await api.post(`/api/v1/customers/${route.params.id}/tags`, { tagId });
    ElMessage.success('标签添加成功'); tagDialogVisible.value = false; fetchDetail();
  } catch { ElMessage.error('添加标签失败'); }
}

async function removeTag(tagId: number) {
  try { await api.delete(`/api/v1/customers/${route.params.id}/tags/${tagId}`); ElMessage.success('标签移除成功'); fetchDetail(); } catch { ElMessage.error('移除标签失败'); }
}

async function handleAddFollowUp() {
  if (!followForm.content) { ElMessage.warning('请输入跟进内容'); return; }
  followSubmitting.value = true;
  try {
    await api.post('/api/v1/follow-ups', { customerId: Number(route.params.id), ...followForm });
    ElMessage.success('跟进记录已添加');
    followUpDialog.value = false;
    fetchFollowUps();
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '添加失败'); } finally { followSubmitting.value = false; }
}

onMounted(() => { fetchDetail(); fetchTags(); fetchFollowUps(); });
</script>
