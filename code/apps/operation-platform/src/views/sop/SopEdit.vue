<template>
  <div>
    <el-page-header @back="$router.push('/sop')" :content="isEdit ? '编辑 SOP' : '新建 SOP'" style="margin-bottom:20px" />

    <el-row :gutter="20">
      <el-col :span="14">
        <el-card>
          <template #header>基本信息</template>
          <el-form :model="form" label-width="100px">
            <el-form-item label="SOP 名称"><el-input v-model="form.name" placeholder="如：新客欢迎SOP" /></el-form-item>
            <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
            <el-form-item label="类型">
              <el-radio-group v-model="form.type">
                <el-radio value="customer">客户SOP</el-radio>
                <el-radio value="group">群SOP</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="触发方式">
              <el-select v-model="form.triggerType" style="width:100%">
                <el-option label="手动触发" value="manual" />
                <el-option label="自动触发（添加客户时）" value="auto" />
                <el-option label="定时触发" value="schedule" />
              </el-select>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card>
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span>SOP 步骤</span>
              <el-button size="small" type="primary" @click="addStep"><el-icon><Plus /></el-icon> 添加步骤</el-button>
            </div>
          </template>

          <div v-if="steps.length === 0" style="text-align:center;padding:20px;color:#909399">暂无步骤，请点击上方按钮添加</div>

          <div v-for="(step, idx) in steps" :key="idx" class="step-item">
            <div class="step-header">
              <el-tag size="small" type="info">步骤 {{ idx + 1 }}</el-tag>
              <el-button size="small" type="danger" text @click="removeStep(idx)">删除</el-button>
            </div>
            <el-form label-width="80px" size="small">
              <el-form-item label="步骤名称"><el-input v-model="step.name" placeholder="如：发送欢迎消息" /></el-form-item>
              <el-form-item label="动作类型">
                <el-select v-model="step.actionType" style="width:100%">
                  <el-option label="发送消息" value="send_message" />
                  <el-option label="打标签" value="add_tag" />
                  <el-option label="发朋友圈" value="send_friend_circle" />
                </el-select>
              </el-form-item>
              <el-form-item label="消息内容" v-if="step.actionType === 'send_message'">
                <el-input v-model="step.content" type="textarea" :rows="2" placeholder="消息文本" />
              </el-form-item>
              <el-form-item label="标签名" v-if="step.actionType === 'add_tag'">
                <el-input v-model="step.content" placeholder="标签名" />
              </el-form-item>
              <el-form-item label="延迟">
                <el-input-number v-model="step.delayMinutes" :min="0" /> 分钟
              </el-form-item>
            </el-form>
          </div>
        </el-card>

        <div style="margin-top:20px;text-align:right">
          <el-button @click="$router.push('/sop')">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSave">保存 SOP</el-button>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '@/utils/api';

const route = useRoute();
const router = useRouter();
const submitting = ref(false);
const isEdit = computed(() => !!route.params.id);

const form = reactive({ name: '', description: '', type: 'customer', triggerType: 'manual' });

interface StepForm { name: string; actionType: string; content: string; delayMinutes: number; }
const steps = ref<StepForm[]>([]);

function addStep() { steps.value.push({ name: '', actionType: 'send_message', content: '', delayMinutes: 0 }); }
function removeStep(idx: number) { steps.value.splice(idx, 1); }

async function loadSop() {
  if (!route.params.id) return;
  try {
    const res = await api.get(`/api/sop/template/${route.params.id}`);
    const data = res.data;
    Object.assign(form, { name: data.name, description: data.description || '', type: data.type || 'customer', triggerType: data.trigger_type || data.triggerType || 'manual' });
    const stepsRes = await api.get(`/api/sop/steps/${route.params.id}`);
    const stepsData = stepsRes.data || [];
    steps.value = stepsData.map((s: any) => ({
      name: s.name,
      actionType: s.action_type || s.actionType,
      content: typeof s.action_content === 'string' ? s.action_content : JSON.stringify(s.action_content || s.actionContent || {}),
      delayMinutes: s.delay_minutes ?? s.delayMinutes ?? 0,
    }));
  } catch { ElMessage.error('加载 SOP 失败'); }
}

async function handleSave() {
  if (!form.name) { ElMessage.warning('请输入 SOP 名称'); return; }
  submitting.value = true;
  try {
    let templateId = route.params.id as string;
    const body = { ...form, corpId: 1 };
    if (isEdit.value) {
      await api.put(`/api/sop/template/${templateId}`, body);
    } else {
      const res = await api.post('/api/sop/template', body);
      templateId = res.data.id || res.data;
    }
    if (steps.value.length > 0) {
      const stepsBody = steps.value.map((s, i) => ({
        templateId: Number(templateId),
        stepOrder: i + 1,
        name: s.name || `步骤 ${i + 1}`,
        actionType: s.actionType,
        actionContent: s.actionType === 'send_message' ? { text: s.content } : s.actionType === 'add_tag' ? { tagName: s.content } : { content: s.content },
        delayMinutes: s.delayMinutes,
      }));
      await api.post('/api/sop/steps/batch', { steps: stepsBody });
    }
    ElMessage.success('保存成功');
    router.push('/sop');
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '保存失败'); } finally { submitting.value = false; }
}

onMounted(loadSop);
</script>

<style scoped>
.step-item { border: 1px solid #ebeef5; border-radius: 8px; padding: 12px; margin-bottom: 12px; background: #fafafa; }
.step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
</style>
