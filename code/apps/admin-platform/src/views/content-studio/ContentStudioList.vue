<template>
  <div class="content-studio-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>创作中心 · 内容源</span>
          <el-button type="primary" @click="createSource">
            <el-icon><Plus /></el-icon>
            新建内容源
          </el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="sources" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column prop="kbEnabled" label="知识库" width="100">
          <template #default="{ row }">
            <el-tag :type="row.kbEnabled ? 'success' : 'info'" size="small">
              {{ row.kbEnabled ? '启用' : '关闭' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updateTime" label="更新时间" width="180" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="openEditor(row.id)">
              编辑 / 生成
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { contentStudioApi, type ContentSource } from '@/api/contentStudio';

const router = useRouter();
const loading = ref(false);
const sources = ref<ContentSource[]>([]);

async function fetchSources() {
  loading.value = true;
  try {
    const res = await contentStudioApi.listSources();
    sources.value = res.data?.list ?? [];
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

async function createSource() {
  try {
    const res = await contentStudioApi.createSource({
      title: '新建内容源',
      body: '',
      kbEnabled: true
    });
    router.push(`/content-studio/${res.data.id}`);
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '创建失败');
  }
}

function openEditor(id: number) {
  router.push(`/content-studio/${id}`);
}

onMounted(fetchSources);
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
