<template>
  <div>
    <el-page-header @back="$router.push('/sop')" :content="isEdit ? '编辑 SOP' : '新建 SOP'" style="margin-bottom:20px" />

    <el-row :gutter="20">
      <el-col :span="14">
        <el-card>
          <template #header>基本信息</template>
          <el-form :model="form" label-width="100px">
            <el-form-item label="SOP 名称" required>
              <el-input v-model="form.templateName" placeholder="如：新客欢迎SOP" />
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="form.description" type="textarea" :rows="3" placeholder="描述此SOP的用途和目标" />
            </el-form-item>
            <el-form-item label="类型" required>
              <el-radio-group v-model="form.templateType">
                <el-radio :value="1">客户SOP</el-radio>
                <el-radio :value="2">群SOP</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="触发方式" required>
              <el-select v-model="form.triggerType" style="width:100%">
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
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span>SOP 步骤 ({{ steps.length }})</span>
              <el-button size="small" type="primary" @click="addStep"><el-icon><Plus /></el-icon> 添加步骤</el-button>
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
                <el-select v-model="step.stepType" style="width:100%" @change="onStepTypeChange(step)">
                  <el-option label="发送消息" :value="1" />
                  <el-option label="打标签" :value="2" />
                  <el-option label="推送素材" :value="3" />
                  <el-option label="分配客户" :value="4" />
                  <el-option label="提醒员工" :value="5" />
                </el-select>
              </el-form-item>
              <el-form-item label="内容" v-if="step.stepType === 1 || step.stepType === 5">
                <el-input v-model="step.contentText" type="textarea" :rows="2" placeholder="消息文本内容" />
              </el-form-item>
              <el-form-item label="标签名" v-if="step.stepType === 2">
                <el-input v-model="step.contentText" placeholder="要打的标签名" />
              </el-form-item>
              <el-form-item label="延迟">
                <div style="display:flex;gap:8px;align-items:center">
                  <el-input-number v-model="step.delayTime" :min="0" size="small" style="width:100px" />
                  <el-select v-model="step.delayUnit" size="small" style="width:90px">
                    <el-option label="分钟" value="minute" />
                    <el-option label="小时" value="hour" />
                    <el-option label="天" value="day" />
                  </el-select>
                </div>
              </el-form-item>
            </el-form>
          </div>
        </el-card>

        <div style="margin-top:16px;display:flex;gap:12px;justify-content:flex-end">
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
import { ref, reactive, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Plus, Delete } from '@element-plus/icons-vue';
import api from '@/utils/api';

const route = useRoute();
const router = useRouter();
const submitting = ref(false);
const isEdit = computed(() => !!route.params.id);

const form = reactive({
  templateName: '',
  description: '',
  templateType: 1,
  triggerType: 4,
});

interface StepForm {
  stepName: string;
  stepType: number;
  contentText: string;
  delayTime: number;
  delayUnit: string;
}

const steps = ref<StepForm[]>([]);

function addStep() {
  steps.value.push({ stepName: '', stepType: 1, contentText: '', delayTime: 0, delayUnit: 'minute' });
}

function onStepTypeChange(step: StepForm) {
  step.contentText = '';
}

function buildActionContent(step: StepForm): any {
  if (step.stepType === 1 || step.stepType === 5) return { text: step.contentText };
  if (step.stepType === 2) return { tagName: step.contentText };
  return { content: step.contentText };
}

async function loadSop() {
  if (!route.params.id) return;
  try {
    const res = await api.get(`/api/sop/template/${route.params.id}`);
    const data = res.data;
    Object.assign(form, {
      templateName: data.templateName,
      description: data.description || '',
      templateType: data.templateType,
      triggerType: data.triggerType,
    });
    if (data.steps) {
      steps.value = data.steps.map((s: any) => ({
        stepName: s.stepName,
        stepType: s.stepType,
        contentText: s.actionContent?.text || s.actionContent?.tagName || '',
        delayTime: s.delayTime || 0,
        delayUnit: s.delayUnit || 'minute',
      }));
    }
  } catch { ElMessage.error('加载 SOP 失败'); }
}

async function handleSave() {
  if (!form.templateName) { ElMessage.warning('请输入 SOP 名称'); return; }
  submitting.value = true;
  try {
    const stepsPayload = steps.value.map((s, i) => ({
      stepOrder: i + 1,
      stepName: s.stepName || `步骤 ${i + 1}`,
      stepType: s.stepType,
      actionType: s.stepType,
      actionContent: buildActionContent(s),
      delayTime: s.delayTime,
      delayUnit: s.delayUnit,
    }));

    if (isEdit.value) {
      await api.put(`/api/sop/template/${route.params.id}`, {
        templateName: form.templateName,
        description: form.description,
        templateType: form.templateType,
        triggerType: form.triggerType,
      });
      if (stepsPayload.length > 0) {
        await api.post('/api/sop/steps/batch', {
          templateId: Number(route.params.id),
          steps: stepsPayload,
        });
      }
    } else {
      await api.post('/api/sop/template', {
        ...form,
        steps: stepsPayload,
      });
    }
    ElMessage.success(isEdit.value ? '保存成功' : '创建成功');
    router.push('/sop');
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadSop);
</script>

<style scoped>
.step-item { border: 1px solid #e4e7ed; border-radius: 8px; padding: 12px; margin-bottom: 12px; background: #fafbfc; }
.step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
</style>
