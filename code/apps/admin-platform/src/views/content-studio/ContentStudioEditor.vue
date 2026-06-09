<template>
  <div class="content-studio-editor" v-loading="loading">
    <el-row :gutter="16">
      <el-col :span="16">
        <el-card>
          <template #header>核心内容源</template>
          <el-form :model="form" label-width="100px">
            <el-form-item label="标题">
              <el-input v-model="form.title" />
            </el-form-item>
            <el-form-item label="摘要">
              <el-input v-model="form.summary" type="textarea" :rows="2" />
            </el-form-item>
            <el-form-item label="正文">
              <el-input v-model="form.body" type="textarea" :rows="8" />
            </el-form-item>
            <el-form-item label="关键词">
              <el-select v-model="form.keywords" multiple filterable allow-create default-first-option style="width: 100%" />
            </el-form-item>
            <el-form-item label="知识库">
              <el-switch v-model="form.kbEnabled" active-text="启用 grounding" />
            </el-form-item>
            <el-form-item label="KB 检索词">
              <el-input v-model="form.kbQuery" placeholder="留空则使用标题+关键词" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveSource">保存</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card style="margin-top: 16px">
          <template #header>
            <div class="card-header">
              <span>多平台生成</span>
              <el-button type="success" :loading="generating" @click="runGenerate">
                一键生成
              </el-button>
            </div>
          </template>
          <el-checkbox-group v-model="selectedChannels">
            <el-checkbox label="tweet">Tweet</el-checkbox>
            <el-checkbox label="xhs_graphic">小红书图文</el-checkbox>
            <el-checkbox label="wechat_article">公众号文章</el-checkbox>
          </el-checkbox-group>
        </el-card>

        <el-card v-if="variants.length" style="margin-top: 16px">
          <template #header>生成结果</template>
          <el-tabs v-model="activeVariantTab">
            <el-tab-pane
              v-for="variant in variants"
              :key="variant.id"
              :label="variant.channel"
              :name="String(variant.id)"
            >
              <el-input v-model="variant.title" placeholder="标题" style="margin-bottom: 12px" />
              <el-input v-model="variant.body" type="textarea" :rows="10" />
              <div v-if="citations(variant).length" class="citations">
                <div class="citations-title">引用来源</div>
                <el-tag v-for="c in citations(variant)" :key="c.path" size="small" style="margin: 4px">
                  {{ c.title }} · {{ c.path }}
                </el-tag>
              </div>
              <div style="margin-top: 12px">
                <el-button type="primary" @click="openPushDialog(variant)">推送草稿</el-button>
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>知识库检索</span>
              <el-tag size="small" :type="kbStatusOk ? 'success' : 'warning'">
                {{ kbStatusText }}
              </el-tag>
            </div>
          </template>
          <el-input v-model="kbSearchQuery" placeholder="搜索 llm-wiki" />
          <el-button style="margin-top: 8px" @click="searchKb" :loading="kbSearching">检索</el-button>
          <el-empty v-if="!kbHits.length" description="暂无命中" />
          <div v-for="hit in kbHits" :key="hit.path" class="kb-hit">
            <div class="kb-hit-title">{{ hit.title }}</div>
            <div class="kb-hit-snippet">{{ hit.snippet }}</div>
            <div class="kb-hit-path">{{ hit.path }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="pushDialogVisible" title="推送草稿" width="420px">
      <el-form label-width="90px">
        <el-form-item label="平台">
          <el-select v-model="pushForm.platform" style="width: 100%">
            <el-option label="小红书" value="xiaohongshu" />
            <el-option label="抖音" value="douyin" />
          </el-select>
        </el-form-item>
        <el-form-item label="账号 ID">
          <el-input-number v-model="pushForm.accountId" :min="1" />
        </el-form-item>
        <el-form-item label="内容类型">
          <el-select v-model="pushForm.contentType" style="width: 100%">
            <el-option label="图文" :value="1" />
            <el-option label="视频" :value="2" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pushDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pushing" @click="confirmPush">推送</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { contentStudioApi, type ContentSource, type ContentVariant } from '@/api/contentStudio';

interface Citation {
  path: string;
  title: string;
  snippet?: string;
}

const route = useRoute();
const sourceId = Number(route.params.sourceId);

const loading = ref(false);
const saving = ref(false);
const generating = ref(false);
const kbSearching = ref(false);
const pushing = ref(false);
const kbStatusOk = ref(false);
const kbStatusText = ref('检查中...');
const kbSearchQuery = ref('');
const kbHits = ref<Citation[]>([]);
const variants = ref<ContentVariant[]>([]);
const activeVariantTab = ref('');
const selectedChannels = ref(['tweet', 'xhs_graphic']);
const pushDialogVisible = ref(false);
const pushTarget = ref<ContentVariant | null>(null);

const form = reactive({
  title: '',
  summary: '',
  body: '',
  keywords: [] as string[],
  tone: '',
  targetAudience: '',
  kbEnabled: true,
  kbQuery: '',
});

const pushForm = reactive({
  platform: 'xiaohongshu',
  accountId: 1,
  contentType: 1,
});

function citations(variant: ContentVariant): Citation[] {
  const list = variant.structured?.citations;
  return Array.isArray(list) ? (list as Citation[]) : [];
}

async function loadSource() {
  loading.value = true;
  try {
    const res = await contentStudioApi.getSource(sourceId);
    const data = res.data as ContentSource;
    form.title = data.title ?? '';
    form.summary = data.summary ?? '';
    form.body = data.body ?? '';
    form.keywords = data.keywords ?? [];
    form.tone = data.tone ?? '';
    form.targetAudience = data.targetAudience ?? '';
    form.kbEnabled = data.kbEnabled ?? false;
    form.kbQuery = data.kbQuery ?? '';
  } finally {
    loading.value = false;
  }
}

async function loadKbHealth() {
  try {
    const res = await contentStudioApi.kbHealth();
    kbStatusOk.value = res.data?.status === 'running';
    kbStatusText.value = kbStatusOk.value ? 'LLM Wiki 在线' : 'LLM Wiki 不可用';
  } catch {
    kbStatusOk.value = false;
    kbStatusText.value = 'LLM Wiki 不可用';
  }
}

async function saveSource() {
  saving.value = true;
  try {
    await contentStudioApi.updateSource(sourceId, { ...form });
    ElMessage.success('已保存');
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

async function searchKb() {
  if (!kbSearchQuery.value.trim()) {
    ElMessage.warning('请输入检索词');
    return;
  }
  kbSearching.value = true;
  try {
    const res = await contentStudioApi.kbSearch({
      query: kbSearchQuery.value,
      topK: 5,
      includeContent: false,
    });
    kbHits.value = res.data?.citations ?? res.data?.results ?? [];
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '检索失败');
  } finally {
    kbSearching.value = false;
  }
}

async function runGenerate() {
  if (!selectedChannels.value.length) {
    ElMessage.warning('请至少选择一个渠道');
    return;
  }
  generating.value = true;
  try {
    await saveSource();
    const res = await contentStudioApi.generate(sourceId, {
      channels: selectedChannels.value,
      kbEnabled: form.kbEnabled,
      kbQuery: form.kbQuery || undefined,
    });
    variants.value = res.data?.variants ?? [];
    if (variants.value.length) {
      activeVariantTab.value = String(variants.value[0].id);
    }
    ElMessage.success(`生成完成：${res.data?.status}`);
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '生成失败');
  } finally {
    generating.value = false;
  }
}

function openPushDialog(variant: ContentVariant) {
  pushTarget.value = variant;
  pushDialogVisible.value = true;
}

async function confirmPush() {
  if (!pushTarget.value) return;
  pushing.value = true;
  try {
    await contentStudioApi.pushDraft(pushTarget.value.id, { ...pushForm });
    ElMessage.success('已推送草稿');
    pushDialogVisible.value = false;
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '推送失败');
  } finally {
    pushing.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadSource(), loadKbHealth()]);
});
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.kb-hit {
  margin-top: 12px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 6px;
}
.kb-hit-title {
  font-weight: 600;
}
.kb-hit-snippet,
.kb-hit-path {
  font-size: 12px;
  color: #606266;
  margin-top: 4px;
}
.citations {
  margin-top: 12px;
}
.citations-title {
  font-size: 13px;
  color: #606266;
  margin-bottom: 4px;
}
</style>
