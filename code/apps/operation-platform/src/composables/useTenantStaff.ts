import { ref } from 'vue';
import api from '@/utils/api';
import { errorMessage } from '@/utils/error-message';

export interface TenantStaff {
  id: string;
  username: string;
  realName: string | null;
}
interface StaffPage {
  list: TenantStaff[];
  total: number;
  page: number;
  pageSize: number;
}

/** Keep exact directory IDs until a validated numeric payload is needed. */
export function safeStaffNumber(value: unknown): number | null {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)))
    return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
export function numericStaffIds(values: string[]): number[] | null {
  const ids = values.map(safeStaffNumber);
  return ids.every((id): id is number => id !== null) ? [...new Set(ids)] : null;
}
export function preservedStaffIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.flatMap(id => (typeof id === 'string' || typeof id === 'number' ? [String(id)] : []))
    )
  ];
}
export function staffLabel(staff: TenantStaff): string {
  return staff.username
    ? staff.realName
      ? `${staff.realName}（${staff.username}）`
      : staff.username
    : staff.realName || `已配置员工 #${staff.id}`;
}

export function useTenantStaff() {
  const results = ref<TenantStaff[]>([]);
  const cached = ref<Record<string, TenantStaff>>({});
  const loading = ref(false);
  const error = ref('');
  let latest = 0;
  async function search(keyword: string) {
    const request = ++latest;
    loading.value = true;
    error.value = '';
    try {
      const response = await api.get<StaffPage>('/api/v1/staff', {
        params: { page: 1, pageSize: 20, ...(keyword.trim() ? { keyword: keyword.trim() } : {}) }
      });
      if (request !== latest) return;
      results.value = response.data.list;
      for (const staff of results.value) cached.value[staff.id] = staff;
    } catch (reason: unknown) {
      if (request !== latest) return;
      results.value = [];
      error.value = errorMessage(reason, '员工搜索失败，请重试');
    } finally {
      if (request === latest) loading.value = false;
    }
  }
  return { results, cached, loading, error, search };
}
