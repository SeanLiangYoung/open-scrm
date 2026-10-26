<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>SCRM 运营平台</h1>
        <p>客户运营 · SOP管理 · 数据分析</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            :disabled="loading"
            placeholder="用户名"
            :prefix-icon="User"
            size="large"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            :disabled="loading"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item prop="corpId">
          <el-input
            v-model="form.corpId"
            :disabled="loading"
            placeholder="企业编号（同名账号需填写，可选）"
            inputmode="numeric"
            size="large"
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="login-btn"
            @click="handleLogin"
            >登 录</el-button
          >
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { errorMessage } from '@/utils/error-message';
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({ username: '', password: '', corpId: '' });
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

async function handleLogin() {
  if (!formRef.value || loading.value) return;
  loading.value = true;
  try {
    const valid = await formRef.value.validate().catch(() => false);
    if (!valid) return;
    const corpId = form.corpId === '' ? undefined : Number(form.corpId);
    if (
      corpId !== undefined &&
      (!/^[1-9]\d*$/.test(form.corpId) || !Number.isSafeInteger(corpId))
    ) {
      ElMessage.warning('企业编号必须为安全的十进制正整数');
      return;
    }
    const accepted = await authStore.login(form.username, form.password, corpId);
    if (accepted === false) return;
    ElMessage.success('登录成功');
    router.push('/');
  } catch (err: unknown) {
    ElMessage.error(errorMessage(err, '登录失败'));
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
}
.login-card {
  width: 400px;
  padding: 40px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}
.login-header {
  text-align: center;
  margin-bottom: 32px;
}
.login-header h1 {
  font-size: 24px;
  color: #303133;
  margin: 0 0 8px;
}
.login-header p {
  font-size: 14px;
  color: #909399;
  margin: 0;
}
.login-btn {
  width: 100%;
}
</style>
