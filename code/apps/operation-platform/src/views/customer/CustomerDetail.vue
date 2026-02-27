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
              <el-tag size="small">{{ sourceLabel(customer.source) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="statusType(customer.status)" size="small">{{ statusLabel(customer.status) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间" :span="2">{{ formatDate(customer.create_time || customer.createTime) }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ customer.remark || '暂无备注' }}</el-descriptions-item>
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
            <el-tag v-for="tag in customer.tags" :key="tag.id" :color="tag.color" closable @close="removeTag(tag.id)" style="margin:4px">{{ tag.name }}</el-tag>
          </div>
          <el-empty v-else description="暂无标签" :image-size="60" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>操作记录</template>
          <el-timeline>
            <el-timeline-item timestamp="刚刚" type="primary">查看了客户详情</el-timeline-item>
            <el-timeline-item timestamp="1小时前" type="success">添加了标签"高意向"</el-timeline-item>
            <el-timeline-item timestamp="昨天" type="warning">发送了欢迎消息</el-timeline-item>
            <el-timeline-item timestamp="3天前">客户通过抖音渠道添加</el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="tagDialogVisible" title="添加标签" width="400px">
      <el-select v-model="selectedTagIds" multiple placeholder="选择标签" style="width:100%">
        <el-option v-for="t in allTags" :key="t.id" :label="t.name" :value="t.id" />
      </el-select>
      <template #footer>
        <el-button @click="tagDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="addTags">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';

const route = useRoute();
const loading = ref(true);
const customer = ref<any>(null);
const allTags = ref<any[]>([]);
const selectedTagIds = ref<number[]>([]);
const tagDialogVisible = ref(false);

const sourceMap: Record<string, string> = { douyin: '抖音', xiaohongshu: '小红书', wechat: '微信', offline: '线下' };
const sourceLabel = (s: string) => sourceMap[s] || s || '-';
const statusLabel = (s: number) => ['流失', '正常', '待跟进'][s] || '未知';
const statusType = (s: number): any => ['danger', 'success', 'warning'][s] || 'info';
const formatDate = (d: string) => d ? new Date(d).toLocaleString('zh-CN') : '-';

async function fetchDetail() {
  loading.value = true;
  try {
    const res = await api.get(`/api/v1/customers/${route.params.id}`);
    customer.value = res.data;
  } catch { ElMessage.error('获取客户详情失败'); } finally { loading.value = false; }
}

async function fetchTags() {
  try {
    const res = await api.get('/api/v1/tags');
    const data = res.data;
    allTags.value = data?.list || data?.items || (Array.isArray(data) ? data : []);
  } catch {}
}

function showTagDialog() { selectedTagIds.value = []; tagDialogVisible.value = true; }

async function addTags() {
  try {
    for (const tagId of selectedTagIds.value) {
      await api.post(`/api/v1/customers/${route.params.id}/tags`, { tagId });
    }
    ElMessage.success('标签添加成功');
    tagDialogVisible.value = false;
    fetchDetail();
  } catch { ElMessage.error('添加标签失败'); }
}

async function removeTag(tagId: number) {
  try {
    await api.delete(`/api/v1/customers/${route.params.id}/tags/${tagId}`);
    ElMessage.success('标签移除成功');
    fetchDetail();
  } catch { ElMessage.error('移除标签失败'); }
}

onMounted(() => { fetchDetail(); fetchTags(); });
</script>
