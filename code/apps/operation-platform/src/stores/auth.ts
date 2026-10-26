import type { AuthUser } from '@/types/view-models';
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/utils/api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const user = ref<AuthUser | null>(JSON.parse(localStorage.getItem('user') || 'null'));
  const isAuthenticated = computed(() => !!token.value);
  let latestAttempt = 0;

  async function login(username: string, password: string, corpId?: number): Promise<void | false> {
    const attempt = ++latestAttempt;
    if (corpId !== undefined && (!Number.isSafeInteger(corpId) || corpId < 1)) {
      throw new Error('企业编号必须为安全的十进制正整数');
    }
    try {
      const res = await api.post('/api/v1/auth/login', {
        username,
        password,
        ...(corpId === undefined ? {} : { corpId })
      });
      if (attempt !== latestAttempt) return false;
      token.value = res.data.accessToken;
      user.value = res.data.user;
      localStorage.setItem('token', token.value);
      localStorage.setItem('user', JSON.stringify(user.value));
    } catch (error: unknown) {
      if (attempt !== latestAttempt) return false;
      throw error;
    }
  }

  function logout() {
    latestAttempt++;
    token.value = '';
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  return { token, user, isAuthenticated, login, logout };
});
