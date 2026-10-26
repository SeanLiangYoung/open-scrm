<template>
  <div>
    <el-card>
      <template #header>企业信息</template>
      <el-form :model="corpForm" label-width="120px" style="max-width: 600px">
        <el-form-item label="企业名称">
          <el-input v-model="corpForm.name" placeholder="请输入企业名称" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="corpForm.contact" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="corpForm.phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="企业邮箱">
          <el-input v-model="corpForm.email" placeholder="请输入企业邮箱" />
        </el-form-item>
        <el-form-item label="企业地址">
          <el-input v-model="corpForm.address" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveCorp">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-top: 20px">
      <template #header>安全设置</template>
      <el-form label-width="120px" style="max-width: 600px">
        <el-form-item label="密码策略">
          <el-select v-model="securityForm.passwordPolicy" style="width: 100%">
            <el-option label="弱 — 不限制" value="weak" />
            <el-option label="中 — 至少8位，含字母和数字" value="medium" />
            <el-option label="强 — 至少8位，含大小写字母、数字和特殊字符" value="strong" />
          </el-select>
        </el-form-item>
        <el-form-item label="会话超时">
          <el-select v-model="securityForm.sessionTimeout" style="width: 100%">
            <el-option label="30 分钟" :value="30" />
            <el-option label="1 小时" :value="60" />
            <el-option label="2 小时" :value="120" />
            <el-option label="8 小时" :value="480" />
            <el-option label="永不超时" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="登录失败锁定">
          <el-input-number v-model="securityForm.maxLoginAttempts" :min="3" :max="10" />
          次后锁定账号
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveSecurity">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { ElMessage } from 'element-plus';

const corpForm = reactive({
  name: 'Open SCRM 示例企业',
  contact: '管理员',
  phone: '400-800-1234',
  email: 'admin@open-scrm.com',
  address: ''
});

const securityForm = reactive({
  passwordPolicy: 'strong',
  sessionTimeout: 120,
  maxLoginAttempts: 5
});

function saveCorp() {
  ElMessage.success('企业信息保存成功');
}
function saveSecurity() {
  ElMessage.success('安全设置保存成功');
}
</script>
