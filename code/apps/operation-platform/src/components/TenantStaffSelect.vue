<template>
  <div class="tenant-staff-select">
    <el-select
      :model-value="multiple ? modelValue : modelValue[0]"
      :multiple="multiple"
      :placeholder="placeholder"
      filterable
      remote
      clearable
      :remote-method="search"
      :loading="loading"
      style="width: 100%"
      @update:model-value="updateSelection"
      @visible-change="(visible: boolean) => visible && search('')"
    >
      <el-option
        v-for="staff in options"
        :key="staff.id"
        :label="staffLabel(staff)"
        :value="staff.id"
        :disabled="safeStaffNumber(staff.id) === null"
      />
    </el-select>
    <div class="staff-hint">当前搜索结果；已配置员工保留至主动更改</div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import {
  useTenantStaff,
  safeStaffNumber,
  staffLabel,
  type TenantStaff
} from '@/composables/useTenantStaff';
const props = withDefaults(
  defineProps<{ modelValue: string[]; multiple?: boolean; placeholder?: string }>(),
  {
    multiple: false,
    placeholder: '搜索本企业员工'
  }
);
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();
const { results, cached, loading, error, search } = useTenantStaff();
const options = computed(() => {
  const selected: TenantStaff[] = props.modelValue.map(
    id => cached.value[id] || { id, username: '', realName: `已配置员工 #${id}` }
  );
  return [...new Map([...selected, ...results.value].map(staff => [staff.id, staff])).values()];
});
function updateSelection(value: unknown) {
  const ids = Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string')
    : typeof value === 'string' && value
      ? [value]
      : [];
  emit('update:modelValue', ids);
}
</script>
<style scoped>
.tenant-staff-select {
  width: 100%;
}
.staff-hint {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
}
</style>
