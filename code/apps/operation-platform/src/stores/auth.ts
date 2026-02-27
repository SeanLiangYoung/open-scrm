import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/utils/api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const user = ref<any>(JSON.parse(localStorage.getItem('user') || 'null'));
  const isAuthenticated = computed(() => !!token.value);

  async function login(username: string, password: string) {
    const res = await api.post('/api/v1/auth/login', { username, password });
    token.value = res.data.accessToken;
    user.value = res.data.user;
    localStorage.setItem('token', token.value);
    localStorage.setItem('user', JSON.stringify(user.value));
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  return { token, user, isAuthenticated, login, logout };
});
