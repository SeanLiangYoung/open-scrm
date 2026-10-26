<template>
  <div v-loading="loading" class="content-studio-editor">
    <el-steps :active="activeStep" finish-status="success" align-center class="wizard-steps">
      <el-step title="选材" description="搜索并勾选 wiki 记录" />
      <el-step title="合成核心稿" description="LLM 生成标题与正文" />
      <el-step title="定稿" description="人工调整并保存" />
      <el-step title="发布" description="生成变体并推送" />
    </el-steps>

    <el-card class="wizard-panel">
      <!-- Step 1: 选材 -->
      <div v-show="activeStep === 0">
        <div class="card-header">
          <span>知识库检索</span>
          <el-tag size="small" :type="kbStatusOk ? 'success' : 'warning'">
            {{ kbStatusText }}
          </el-tag>
        </div>
        <el-alert
          v-if="!kbStatusOk"
          type="warning"
          show-icon
          :closable="false"
          title="LLM Wiki 不可用，请先启动 llm-wiki 后再选材"
          style="margin-bottom: 12px"
        />
        <el-input v-model="kbSearchQuery" placeholder="搜索 llm-wiki" />
        <el-button style="margin-top: 8px" :loading="kbSearching" @click="searchKb">检索</el-button>
        <el-empty v-if="!kbHits.length" description="暂无命中" />
        <el-checkbox-group v-model="selectedKbPaths" style="width: 100%">
          <div v-for="hit in kbHits" :key="hit.path" class="kb-hit">
            <el-checkbox :label="hit.path">
              <div class="kb-hit-title">{{ hit.title }}</div>
            </el-checkbox>
            <div class="kb-hit-snippet">{{ hit.snippet }}</div>
            <div class="kb-hit-path">{{ hit.path }}</div>
          </div>
        </el-checkbox-group>
        <div v-if="selectedKbPaths.length" class="kb-selected">
          <div class="citations-title">已选 {{ selectedKbPaths.length }} 条</div>
          <el-tag
            v-for="path in selectedKbPaths"
            :key="path"
            size="small"
            closable
            style="margin: 4px"
            @close="removeSelectedPath(path)"
          >
            {{ citationTitle(path) }}
          </el-tag>
        </div>
      </div>

      <!-- Step 2: 合成 -->
      <div v-show="activeStep === 1">
        <p class="step-hint">
          基于已选 {{ selectedKbPaths.length }} 条 wiki 记录，由 LLM 合成核心标题、摘要与正文。
        </p>
        <el-form label-width="100px">
          <el-form-item label="语气">
            <el-input v-model="form.tone" placeholder="如：专业、轻松" />
          </el-form-item>
          <el-form-item label="目标读者">
            <el-input v-model="form.targetAudience" placeholder="如：创作者、运营" />
          </el-form-item>
          <el-form-item label="补充意图">
            <el-input
              v-model="composeInstruction"
              type="textarea"
              :rows="2"
              placeholder="可选：希望强调的角度"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="composing" @click="runCompose">
              从选中页生成
            </el-button>
          </el-form-item>
        </el-form>
        <div v-if="composeCitations.length" class="citations">
          <div class="citations-title">引用来源</div>
          <el-tag v-for="c in composeCitations" :key="c.path" size="small" style="margin: 4px">
            {{ c.title }} · {{ c.path }}
          </el-tag>
        </div>
        <el-alert
          v-if="form.body"
          type="success"
          show-icon
          :closable="false"
          title="核心稿已生成，可进入下一步定稿"
          style="margin-top: 12px"
        />
      </div>

      <!-- Step 3: 定稿 -->
      <div v-show="activeStep === 2">
        <el-form :model="form" label-width="100px">
          <el-form-item label="标题">
            <el-input v-model="form.title" />
          </el-form-item>
          <el-form-item label="摘要">
            <el-input v-model="form.summary" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="正文">
            <el-input v-model="form.body" type="textarea" :rows="10" />
          </el-form-item>
          <el-form-item label="关键词">
            <el-select
              v-model="form.keywords"
              multiple
              filterable
              allow-create
              default-first-option
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="saving" @click="saveFinalizedSource">
              保存定稿
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- Step 4: 发布 -->
      <div v-show="activeStep === 3">
        <div class="card-header">
          <span>选择渠道并生成变体</span>
          <div class="header-actions">
            <el-button type="success" :loading="generating" @click="runGenerate">
              生成变体
            </el-button>
            <el-button
              v-if="variants.length"
              type="primary"
              :loading="batchPublishing"
              :disabled="!canBatchPublish"
              @click="batchPushAndPublish"
            >
              推送并发布
            </el-button>
          </div>
        </div>
        <el-checkbox-group v-model="selectedChannels">
          <el-checkbox label="tweet">Tweet</el-checkbox>
          <el-checkbox label="xhs_graphic">小红书图文</el-checkbox>
          <el-checkbox label="wechat_article">公众号文章</el-checkbox>
          <el-checkbox label="short_video_script">短视频脚本</el-checkbox>
          <el-checkbox label="long_video_script">长视频脚本</el-checkbox>
          <el-checkbox label="douyin_caption">抖音文案</el-checkbox>
        </el-checkbox-group>

        <el-tabs v-if="variants.length" v-model="activeVariantTab" style="margin-top: 16px">
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
              <el-tag
                v-for="c in citations(variant)"
                :key="c.path"
                size="small"
                style="margin: 4px"
              >
                {{ c.title }} · {{ c.path }}
              </el-tag>
            </div>
            <el-form label-width="90px" style="margin-top: 12px">
              <el-form-item label="平台">
                <el-input
                  :model-value="platformLabel(variantPushPlan(variant.id).platform)"
                  disabled
                />
              </el-form-item>
              <el-form-item label="发布账号">
                <el-select
                  v-model="variantPushPlan(variant.id).accountId"
                  style="width: 100%"
                  placeholder="选择平台账号"
                  @visible-change="(visible: boolean) => visible && loadAccountsForVariant(variant)"
                >
                  <el-option
                    v-for="account in accountsForPlatform(variantPushPlan(variant.id).platform)"
                    :key="account.id"
                    :label="account.accountName"
                    :value="account.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="内容类型">
                <el-select v-model="variantPushPlan(variant.id).contentType" style="width: 100%">
                  <el-option label="图文" :value="1" />
                  <el-option label="视频" :value="2" />
                </el-select>
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>

        <el-table v-if="drafts.length" :data="drafts" size="small" style="margin-top: 16px">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="title" label="标题" />
          <el-table-column prop="platform" label="平台" width="110" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag size="small">{{ draftStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 0"
                type="success"
                link
                :loading="publishing && publishingDraftId === row.id"
                @click="publishDraft(row.id)"
              >
                发布
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <div class="wizard-footer">
      <el-button :disabled="activeStep === 0" @click="prevStep">上一步</el-button>
      <el-button v-if="activeStep < 3" type="primary" @click="nextStep">下一步</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  contentStudioApi,
  type ContentSource,
  type ContentVariant,
  type KbCitation
} from '@/api/contentStudio';

interface Citation extends KbCitation {}

interface PlatformAccount {
  id: number;
  platform: string;
  accountName: string;
}

interface VariantPushPlan {
  platform: string;
  accountId: number | null;
  contentType: number;
}

const CHANNEL_PLATFORM: Record<string, string> = {
  tweet: 'twitter',
  xhs_graphic: 'xiaohongshu',
  wechat_article: 'wechat',
  short_video_script: 'douyin',
  long_video_script: 'douyin',
  douyin_caption: 'douyin'
};

const PLATFORM_LABELS: Record<string, string> = {
  xiaohongshu: '小红书',
  douyin: '抖音',
  wechat: '微信公众号',
  twitter: 'X / Twitter'
};

const route = useRoute();
const sourceId = Number(route.params.sourceId);

const loading = ref(false);
const saving = ref(false);
const composing = ref(false);
const generating = ref(false);
const batchPublishing = ref(false);
const kbSearching = ref(false);
const publishing = ref(false);
const kbStatusOk = ref(false);
const kbStatusText = ref('检查中...');
const kbSearchQuery = ref('');
const kbHits = ref<Citation[]>([]);
const selectedKbPaths = ref<string[]>([]);
const kbCitationMap = ref<Record<string, Citation>>({});
const composeCitations = ref<Citation[]>([]);
const composeInstruction = ref('');
const composeStatus = ref<ContentSource['composeStatus']>('draft');
const activeStep = ref(0);
const variants = ref<ContentVariant[]>([]);
const drafts = ref<
  Array<{
    id: number;
    title?: string | null;
    platform: string;
    status: number;
    platformContentId?: string | null;
  }>
>([]);
const activeVariantTab = ref('');
const selectedChannels = ref(['tweet', 'xhs_graphic']);
const variantPushPlans = reactive<Record<number, VariantPushPlan>>({});
const platformAccounts = reactive<Record<string, PlatformAccount[]>>({});

const form = reactive({
  title: '',
  summary: '',
  body: '',
  keywords: [] as string[],
  tone: '',
  targetAudience: '',
  kbEnabled: true,
  kbQuery: ''
});

const publishingDraftId = ref<number | null>(null);

const canBatchPublish = computed(
  () =>
    variants.value.length > 0 &&
    variants.value.every(v => {
      const plan = variantPushPlans[v.id];
      return plan?.accountId != null && plan.accountId > 0;
    })
);

function platformForChannel(channel: string): string {
  return CHANNEL_PLATFORM[channel] ?? 'xiaohongshu';
}

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

function variantPushPlan(variantId: number): VariantPushPlan {
  if (!variantPushPlans[variantId]) {
    const variant = variants.value.find(v => v.id === variantId);
    variantPushPlans[variantId] = {
      platform: platformForChannel(variant?.channel ?? ''),
      accountId: null,
      contentType: 1
    };
  }
  return variantPushPlans[variantId];
}

function accountsForPlatform(platform: string): PlatformAccount[] {
  return platformAccounts[platform] ?? [];
}

async function loadAccountsForPlatform(platform: string) {
  if (platformAccounts[platform]?.length) return;
  try {
    const res = await contentStudioApi.listPlatformAccounts({ platform });
    platformAccounts[platform] = res.data?.data?.list ?? res.data?.list ?? [];
  } catch {
    platformAccounts[platform] = [];
  }
}

async function loadAccountsForVariant(variant: ContentVariant) {
  const platform = variantPushPlan(variant.id).platform;
  await loadAccountsForPlatform(platform);
  const accounts = accountsForPlatform(platform);
  if (!variantPushPlan(variant.id).accountId && accounts.length) {
    variantPushPlan(variant.id).accountId = accounts[0].id;
  }
}

watch(variants, newVariants => {
  for (const variant of newVariants) {
    variantPushPlan(variant.id);
    void loadAccountsForVariant(variant);
  }
});

function inferInitialStep(data: ContentSource): number {
  if (!data.kbSelectedPaths?.length) return 0;
  if (data.composeStatus === 'finalized') return 3;
  if (data.composeStatus === 'composed' || data.body?.trim()) return 2;
  return 1;
}

function draftStatusLabel(status: number) {
  const map: Record<number, string> = {
    0: '草稿',
    1: '已发布',
    2: '失败',
    3: '发布中'
  };
  return map[status] ?? String(status);
}

function citations(variant: ContentVariant): Citation[] {
  const list = variant.structured?.citations;
  return Array.isArray(list) ? (list as Citation[]) : [];
}

function citationTitle(path: string): string {
  return kbCitationMap.value[path]?.title ?? path;
}

function removeSelectedPath(path: string) {
  selectedKbPaths.value = selectedKbPaths.value.filter(p => p !== path);
}

function syncCitationMapFromHits(hits: Citation[]) {
  for (const hit of hits) {
    kbCitationMap.value[hit.path] = hit;
  }
}

function buildSelectedCitations(): Citation[] {
  return selectedKbPaths.value.map(path => {
    const known = kbCitationMap.value[path];
    return known ?? { path, title: path };
  });
}

async function saveSelectedPaths() {
  const kbCitations = buildSelectedCitations();
  await contentStudioApi.updateSource(sourceId, {
    kbSelectedPaths: [...selectedKbPaths.value],
    kbCitations
  });
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
    selectedKbPaths.value = data.kbSelectedPaths ?? [];
    composeStatus.value = data.composeStatus ?? 'draft';
    composeCitations.value = data.kbCitations ?? [];
    if (data.kbCitations?.length) {
      syncCitationMapFromHits(data.kbCitations);
    }
    activeStep.value = inferInitialStep(data);
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

async function saveFinalizedSource() {
  if (!form.body.trim()) {
    ElMessage.warning('正文不能为空');
    return;
  }
  saving.value = true;
  try {
    await contentStudioApi.updateSource(sourceId, {
      ...form,
      composeStatus: 'finalized'
    });
    composeStatus.value = 'finalized';
    ElMessage.success('定稿已保存');
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
      includeContent: false
    });
    kbHits.value = res.data?.citations ?? res.data?.results ?? [];
    syncCitationMapFromHits(kbHits.value);
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '检索失败');
  } finally {
    kbSearching.value = false;
  }
}

async function runCompose() {
  if (!selectedKbPaths.value.length) {
    ElMessage.warning('请先选择 wiki 记录');
    return;
  }
  composing.value = true;
  try {
    await saveSelectedPaths();
    const res = await contentStudioApi.composeSource(sourceId, {
      paths: [...selectedKbPaths.value],
      tone: form.tone || undefined,
      targetAudience: form.targetAudience || undefined,
      instruction: composeInstruction.value || undefined
    });
    const data = res.data as ContentSource & { citations?: Citation[] };
    form.title = data.title ?? form.title;
    form.summary = data.summary ?? form.summary;
    form.body = data.body ?? form.body;
    form.keywords = data.keywords ?? form.keywords;
    composeCitations.value = data.citations ?? data.kbCitations ?? [];
    composeStatus.value = 'composed';
    syncCitationMapFromHits(composeCitations.value);
    ElMessage.success('核心稿已生成');
  } catch (error: unknown) {
    const message =
      error instanceof Error && /timeout/i.test(error.message)
        ? '合成超时，LLM 响应较慢，请稍后重试'
        : error instanceof Error
          ? error.message
          : '合成失败';
    ElMessage.error(message);
  } finally {
    composing.value = false;
  }
}

async function pollJob(jobId: number, attempts = 120) {
  for (let i = 0; i < attempts; i += 1) {
    const res = await contentStudioApi.getJob(jobId);
    const job = res.data?.job ?? res.data?.data?.job;
    const jobVariants = res.data?.variants ?? res.data?.data?.variants ?? [];
    if (job?.status === 'succeeded') {
      variants.value = jobVariants;
      if (variants.value.length) {
        activeVariantTab.value = String(variants.value[0].id);
      }
      return job.status as string;
    }
    if (job?.status === 'failed') {
      throw new Error(job.errorMessage || '生成失败');
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('生成超时，请稍后在任务列表重试');
}

async function runGenerate() {
  if (composeStatus.value !== 'finalized') {
    ElMessage.warning('请先在定稿步骤保存核心内容');
    return;
  }
  if (!selectedChannels.value.length) {
    ElMessage.warning('请至少选择一个渠道');
    return;
  }
  generating.value = true;
  try {
    const res = await contentStudioApi.generate(sourceId, {
      channels: selectedChannels.value,
      kbEnabled: form.kbEnabled,
      kbQuery: form.kbQuery || undefined
    });
    const jobId = res.data?.jobId ?? res.data?.data?.jobId;
    const status = res.data?.status ?? res.data?.data?.status;
    if (status === 'pending' && jobId) {
      const finalStatus = await pollJob(jobId);
      ElMessage.success(`生成完成：${finalStatus}`);
      return;
    }
    variants.value = res.data?.variants ?? res.data?.data?.variants ?? [];
    if (variants.value.length) {
      activeVariantTab.value = String(variants.value[0].id);
    }
    ElMessage.success(`生成完成：${status}`);
  } catch (error: unknown) {
    const message =
      error instanceof Error && /timeout/i.test(error.message)
        ? '生成超时，LLM 响应较慢，请稍后重试'
        : error instanceof Error
          ? error.message
          : '生成失败';
    ElMessage.error(message);
  } finally {
    generating.value = false;
  }
}

async function nextStep() {
  if (activeStep.value === 0) {
    if (!selectedKbPaths.value.length) {
      ElMessage.warning('请至少选择一条 wiki 记录');
      return;
    }
    try {
      await saveSelectedPaths();
      ElMessage.success('选材已保存');
    } catch (error: unknown) {
      ElMessage.error(error instanceof Error ? error.message : '保存选材失败');
      return;
    }
  }
  if (activeStep.value === 2) {
    if (!form.body.trim()) {
      ElMessage.warning('请先编辑并保存定稿');
      return;
    }
    if (composeStatus.value !== 'finalized') {
      ElMessage.warning('请先点击「保存定稿」');
      return;
    }
  }
  if (activeStep.value < 3) {
    activeStep.value += 1;
  }
}

function prevStep() {
  if (activeStep.value > 0) {
    activeStep.value -= 1;
  }
}

async function loadDrafts() {
  try {
    const res = await contentStudioApi.listDrafts({ status: 0 });
    drafts.value = res.data?.data?.list ?? res.data?.list ?? [];
  } catch {
    drafts.value = [];
  }
}

async function batchPushAndPublish() {
  if (!canBatchPublish.value) {
    ElMessage.warning('请为每个变体选择发布账号');
    return;
  }
  batchPublishing.value = true;
  try {
    const items = variants.value.map(variant => {
      const plan = variantPushPlan(variant.id);
      return {
        variantId: variant.id,
        platform: plan.platform,
        accountId: plan.accountId as number,
        contentType: plan.contentType
      };
    });
    const pushRes = await contentStudioApi.pushDrafts(sourceId, { items });
    const pushResults = pushRes.data?.results ?? pushRes.data?.data?.results ?? [];
    const contentIds = pushResults
      .filter((r: { success: boolean; contentId?: number }) => r.success && r.contentId)
      .map((r: { contentId: number }) => r.contentId);

    if (!contentIds.length) {
      ElMessage.error('批量推送失败，请检查账号配置');
      return;
    }

    const publishRes = await contentStudioApi.batchPublishContents(contentIds);
    const publishResults = publishRes.data?.results ?? publishRes.data?.data?.results ?? [];
    const succeeded = publishResults.filter((r: { success: boolean }) => r.success).length;
    ElMessage.success(`已推送 ${contentIds.length} 条，成功发布 ${succeeded} 条`);
    await loadDrafts();
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '批量发布失败');
  } finally {
    batchPublishing.value = false;
  }
}

async function publishDraft(contentId: number) {
  publishing.value = true;
  publishingDraftId.value = contentId;
  try {
    const res = await contentStudioApi.publishContent(contentId);
    const platformContentId = res.data?.data?.platformContentId ?? res.data?.platformContentId;
    ElMessage.success(platformContentId ? `发布成功：${platformContentId}` : '发布成功');
    await loadDrafts();
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '发布失败');
  } finally {
    publishing.value = false;
    publishingDraftId.value = null;
  }
}

onMounted(async () => {
  await Promise.all([loadSource(), loadKbHealth(), loadDrafts()]);
});
</script>

<style scoped>
.wizard-steps {
  margin-bottom: 20px;
}
.wizard-panel {
  min-height: 420px;
}
.wizard-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.step-hint {
  color: #606266;
  margin-bottom: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.header-actions {
  display: flex;
  gap: 8px;
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
.kb-selected {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}
</style>
