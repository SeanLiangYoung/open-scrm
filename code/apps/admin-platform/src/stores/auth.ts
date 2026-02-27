import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/utils/api';

interface UserInfo {
  id: string;
  username: string;
  corpId: string;
  isAdmin: number;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const refreshToken = ref(localStorage.getItem('refreshToken') || '');
  const user = ref<UserInfo | null>(
    JSON.parse(localStorage.getItem('user') || 'null')
  );

  const isAuthenticated = computed(() => !!token.value);

  async function login(username: string, password: string) {
    const res = await api.post('/api/v1/auth/login', { username, password });
    token.value = res.data.accessToken;
    refreshToken.value = res.data.refreshToken;
    user.value = res.data.user;

    localStorage.setItem('token', token.value);
    localStorage.setItem('refreshToken', refreshToken.value);
    localStorage.setItem('user', JSON.stringify(user.value));
  }

  function logout() {
    token.value = '';
    refreshToken.value = '';
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  return { token, refreshToken, user, isAuthenticated, login, logout };
});
