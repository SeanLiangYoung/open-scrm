<template>
  <div>
    <el-page-header
      :content="isEdit ? '编辑 SOP' : '新建 SOP'"
      style="margin-bottom: 20px"
      @back="$router.push('/sop')"
    />

    <el-row :gutter="20">
      <el-col :span="14">
        <el-card>
          <template #header>基本信息</template>
          <el-form :model="form" label-width="100px">
            <el-form-item label="SOP 名称" required>
              <el-input v-model="form.templateName" placeholder="如：新客欢迎SOP" />
            </el-form-item>
            <el-form-item label="描述">
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="3"
                placeholder="描述此SOP的用途和目标"
              />
            </el-form-item>
            <el-form-item label="类型" required>
              <el-radio-group v-model="form.templateType">
                <el-radio :value="1">客户SOP</el-radio>
                <el-radio :value="2">群SOP</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="触发方式" required>
              <el-select v-model="form.triggerType" style="width: 100%">
                <el-option label="添加好友时自动触发" :value="1" />
                <el-option label="打标签时触发" :value="2" />
                <el-option label="进群时触发" :value="3" />
                <el-option label="手动触发" :value="4" />
              </el-select>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>SOP 步骤 ({{ steps.length }})</span>
              <el-button size="small" type="primary" @click="addStep"
                ><el-icon><Plus /></el-icon> 添加步骤</el-button
              >
            </div>
          </template>

          <el-empty v-if="steps.length === 0" description="暂无步骤，请添加" :image-size="60" />

          <div v-for="(step, idx) in steps" :key="idx" class="step-item">
            <div class="step-header">
              <el-tag size="small" round>步骤 {{ idx + 1 }}</el-tag>
              <el-button size="small" type="danger" text @click="steps.splice(idx, 1)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-form label-width="70px" size="small">
              <el-form-item label="名称">
                <el-input v-model="step.stepName" placeholder="步骤名称" />
              </el-form-item>
              <el-form-item label="类型">
                <el-select
                  v-model="step.stepType"
                  style="width: 100%"
                  @change="onStepTypeChange(step)"
                >
                  <el-option label="发送消息" :value="1" />
                  <el-option label="打标签" :value="2" :disabled="form.templateType === 2" />
                  <el-option label="推送素材" :value="3" />
                  <el-option label="分配客户" :value="4" :disabled="form.templateType === 2" />
                  <el-option label="提醒员工" :value="5" />
                </el-select>
              </el-form-item>
              <el-alert
                v-if="step.stepType === 1 || step.stepType === 3"
                :title="
                  isMockMessage(step)
                    ? '模拟消息，不会真实送达'
                    : '此旧步骤的渠道尚未接通，保留原配置，不会真实送达'
                "
                :type="isMockMessage(step) ? 'info' : 'warning'"
                :closable="false"
                show-icon
                style="margin-bottom: 12px"
              />
              <el-form-item v-if="step.stepType === 1 || step.stepType === 5" label="内容">
                <el-input
                  v-model="step.contentText"
                  type="textarea"
                  :rows="2"
                  placeholder="消息文本内容"
                />
              </el-form-item>
              <template v-if="step.stepType === 3">
                <el-form-item label="素材链接">
                  <el-input v-model="step.materialUrl" placeholder="素材链接 URL" />
                </el-form-item>
                <el-form-item label="说明">
                  <el-input
                    v-model="step.contentText"
                    type="textarea"
                    placeholder="素材说明（可选）"
                  />
                </el-form-item>
              </template>
              <el-form-item v-if="step.stepType === 4" label="跟进员工">
                <TenantStaffSelect v-model="step.assigneeIds" placeholder="选择跟进员工" />
              </el-form-item>
              <el-form-item v-if="step.stepType === 2" label="标签">
                <el-select
                  v-model="step.tagIds"
                  multiple
                  placeholder="选择标签"
                  style="width: 100%"
                >
                  <el-option
                    v-for="tag in availableTags"
                    :key="tag.id"
                    :label="tag.tagName"
                    :value="tag.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item v-if="step.stepType === 5" label="接收员工">
                <div style="width: 100%">
                  <TenantStaffSelect v-model="step.userIds" multiple />
                  <el-checkbox v-model="step.remindCurrentUser"
                    >提醒当前登录员工（{{ authStore.user?.username }}）</el-checkbox
                  >
                </div>
              </el-form-item>
              <el-form-item label="延迟">
                <div style="display: flex; gap: 8px; align-items: center">
                  <el-input-number
                    v-model="step.delayTime"
                    :min="0"
                    size="small"
                    style="width: 100px"
                  />
                  <el-select v-model="step.delayUnit" size="small" style="width: 90px">
                    <el-option label="分钟" value="minute" />
                    <el-option label="小时" value="hour" />
                    <el-option label="天" value="day" />
                  </el-select>
                </div>
              </el-form-item>
            </el-form>
          </div>
        </el-card>

        <div style="margin-top: 16px; display: flex; gap: 12px; justify-content: flex-end">
          <el-button @click="$router.push('/sop')">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSave">
            {{ isEdit ? '保存修改' : '创建 SOP' }}
          </el-button>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import type { SopStep, Tag } from '@/types/view-models';
import TenantStaffSelect from '@/components/TenantStaffSelect.vue';
import { numericStaffIds, preservedStaffIds, safeStaffNumber } from '@/composables/useTenantStaff';
import { errorMessage } from '@/utils/error-message';
import { ref, reactive, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Plus, Delete } from '@element-plus/icons-vue';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const currentUserId = computed(() => Number(authStore.user?.id));
const availableTags = ref<Tag[]>([]);
const route = useRoute();
const router = useRouter();
const submitting = ref(false);
const originalDescription = ref('');
const isEdit = computed(() => !!route.params.id);

const form = reactive({
  templateName: '',
  description: '',
  templateType: 1,
  triggerType: 4
});

interface StepForm {
  newStep: boolean;
  stepName: string;
  stepType: number;
  contentText: string;
  materialUrl: string;
  delayTime: number;
  delayUnit: string;
  tagIds: number[];
  userIds: string[];
  assigneeIds: string[];
  remindCurrentUser: boolean;
  savedAction: NonNullable<SopStep['actionContent']>;
}

const steps = ref<StepForm[]>([]);

function addStep() {
  steps.value.push({
    newStep: true,
    stepName: '',
    stepType: 1,
    contentText: '',
    materialUrl: '',
    delayTime: 0,
    delayUnit: 'minute',
    tagIds: [],
    userIds: [],
    assigneeIds: [],
    remindCurrentUser: false,
    savedAction: {}
  });
}

function onStepTypeChange(step: StepForm) {
  step.contentText = '';
  step.materialUrl = '';
  step.tagIds = [];
  step.userIds = [];
  step.assigneeIds = [];
  step.remindCurrentUser = false;
  // Changing the action type does not silently change an existing channel intent.
  const hasChannel = Object.prototype.hasOwnProperty.call(step.savedAction, 'messageType');
  step.savedAction = hasChannel ? { messageType: step.savedAction.messageType } : {};
}

function isMockMessage(step: StepForm): boolean {
  return step.newStep || step.savedAction.messageType === 5;
}

function buildActionContent(step: StepForm): NonNullable<SopStep['actionContent']> {
  const channel = step.newStep ? { messageType: 5 } : {};
  if (step.stepType === 1) return { ...step.savedAction, ...channel, content: step.contentText };
  if (step.stepType === 2) return { ...step.savedAction, tagIds: step.tagIds };
  if (step.stepType === 3) {
    const action: Record<string, unknown> = {
      ...step.savedAction,
      ...channel,
      url: step.materialUrl.trim(),
      content: step.contentText
    };
    delete action.assetUrl;
    delete action.link;
    return action;
  }
  if (step.stepType === 4) {
    const action: Record<string, unknown> = {
      ...step.savedAction,
      followUserId: safeStaffNumber(step.assigneeIds[0])
    };
    delete action.staffId;
    return action;
  }
  if (step.stepType === 5)
    return {
      ...step.savedAction,
      userIds:
        numericStaffIds([
          ...step.userIds,
          ...(step.remindCurrentUser ? [String(currentUserId.value)] : [])
        ]) || [],
      content: step.contentText
    };
  return { ...step.savedAction, content: step.contentText };
}

async function loadTags() {
  try {
    const res = await api.get('/api/v1/tags');
    availableTags.value =
      res.data?.list || res.data?.items || (Array.isArray(res.data) ? res.data : []);
  } catch {
    ElMessage.error('获取可用标签失败');
  }
}

/** Match the executor's object / JSON-string / plain-text action decoding. */
function parseSavedAction(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? { ...parsed } : { content: raw };
    } catch {
      return { content: raw };
    }
  }
  return typeof raw === 'object' ? { ...raw } : { content: String(raw) };
}

function savedIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value: unknown) => {
    const id = Number(value);
    return ['string', 'number'].includes(typeof value) &&
      /^[1-9]\d*$/.test(String(value)) &&
      Number.isSafeInteger(id)
      ? [id]
      : [];
  });
}

function restoreStep(step: SopStep): StepForm {
  const action = parseSavedAction(step.actionContent);
  const tagIds = savedIds(action.tagIds ?? action.tags);
  const userIds = preservedStaffIds(
    action.userIds ?? (action.userId != null ? [action.userId] : [])
  );
  if (step.stepType === 2) {
    action.tagIds = tagIds;
    delete action.tags;
  }
  if (step.stepType === 5) {
    action.userIds = userIds;
    delete action.userId;
  }
  const content = step.stepType === 3 ? action.content : (action.content ?? action.text);
  const materialUrl = action.url || action.assetUrl || action.link;
  return {
    newStep: false,
    stepName: step.stepName,
    stepType: step.stepType,
    contentText: typeof content === 'string' ? content : '',
    materialUrl: typeof materialUrl === 'string' ? materialUrl : '',
    tagIds,
    userIds: userIds.filter(id => id !== String(currentUserId.value)),
    assigneeIds:
      action.followUserId != null || action.staffId != null
        ? [String(action.followUserId ?? action.staffId)]
        : [],
    remindCurrentUser: userIds.includes(String(currentUserId.value)),
    savedAction: action,
    delayTime: step.delayTime || 0,
    delayUnit: step.delayUnit || 'minute'
  };
}

async function loadSop() {
  if (!route.params.id) return;
  try {
    const res = await api.get(`/api/sop/template/${route.params.id}`);
    const data = res.data;
    originalDescription.value = data.description || '';
    Object.assign(form, {
      templateName: data.templateName,
      description: data.description || '',
      templateType: data.templateType,
      triggerType: data.triggerType
    });
    if (data.steps) {
      steps.value = data.steps.map(restoreStep);
    }
  } catch {
    ElMessage.error('加载 SOP 失败');
  }
}

async function handleSave() {
  if (!form.templateName.trim()) {
    ElMessage.warning('请输入 SOP 名称');
    return;
  }
  if (steps.value.some(step => step.stepType === 1 && !step.contentText.trim())) {
    ElMessage.warning('请为消息步骤填写内容');
    return;
  }
  if (
    form.templateType === 2 &&
    steps.value.some(step => step.stepType === 2 || step.stepType === 4)
  ) {
    ElMessage.warning('群 SOP 不支持客户打标签或分配步骤，请明确移除或更改该步骤');
    return;
  }
  if (isEdit.value && steps.value.length === 0) {
    ElMessage.warning('至少保留一个步骤，当前不支持清空已有 SOP');
    return;
  }
  if (
    steps.value.some(
      step => step.stepType === 3 && !step.materialUrl.trim() && !step.contentText.trim()
    )
  ) {
    ElMessage.warning('请为素材步骤填写链接或说明');
    return;
  }
  if (steps.value.some(step => step.stepType === 2 && step.tagIds.length === 0)) {
    ElMessage.warning('请为打标签步骤选择标签');
    return;
  }
  if (
    steps.value.some(
      step => step.stepType === 5 && step.userIds.length === 0 && !step.remindCurrentUser
    )
  ) {
    ElMessage.warning('请为提醒步骤选择接收员工');
    return;
  }
  if (
    steps.value.some(step => step.remindCurrentUser) &&
    (!Number.isSafeInteger(currentUserId.value) || currentUserId.value < 1)
  ) {
    ElMessage.warning('无法识别当前员工，请重新登录');
    return;
  }
  if (steps.value.some(step => step.stepType === 4 && step.assigneeIds.length === 0)) {
    ElMessage.warning('请为分配步骤选择跟进员工');
    return;
  }
  if (
    steps.value.some(
      step =>
        (step.stepType === 4 && safeStaffNumber(step.assigneeIds[0]) === null) ||
        (step.stepType === 5 && numericStaffIds(step.userIds) === null)
    )
  ) {
    ElMessage.warning('员工编号超出支持范围，请重新选择员工');
    return;
  }
  submitting.value = true;
  try {
    const stepsPayload = steps.value.map((s, i) => ({
      stepOrder: i + 1,
      stepName: s.stepName || `步骤 ${i + 1}`,
      stepType: s.stepType,
      actionType: s.stepType,
      actionContent: buildActionContent(s),
      delayTime: s.delayTime,
      delayUnit: s.delayUnit
    }));

    const description = form.description.trim();
    const templateFields = {
      templateName: form.templateName.trim(),
      templateType: form.templateType,
      triggerType: form.triggerType,
      ...(description
        ? { description }
        : isEdit.value && originalDescription.value.trim()
          ? { description: null }
          : {})
    };
    if (isEdit.value) {
      await api.put(`/api/sop/template/${route.params.id}`, templateFields);
      if (stepsPayload.length > 0) {
        await api.post('/api/sop/steps/batch', {
          templateId: Number(route.params.id),
          steps: stepsPayload
        });
      }
    } else {
      await api.post('/api/sop/template', {
        ...templateFields,
        steps: stepsPayload
      });
    }
    ElMessage.success(isEdit.value ? '保存成功' : '创建成功');
    router.push('/sop');
  } catch (e: unknown) {
    ElMessage.error(errorMessage(e, '保存失败'));
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadSop();
  loadTags();
});
</script>

<style scoped>
.step-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  background: #fafbfc;
}
.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
</style>
