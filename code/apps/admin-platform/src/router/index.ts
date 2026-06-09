import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      component: () => import('@/layout/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'Dashboard',
          component: () => import('@/views/Dashboard.vue'),
        },
        {
          path: 'users',
          name: 'Users',
          component: () => import('@/views/Users.vue'),
        },
        {
          path: 'roles',
          name: 'Roles',
          component: () => import('@/views/Roles.vue'),
        },
        {
          path: 'settings',
          name: 'Settings',
          component: () => import('@/views/SystemSettings.vue'),
        },
        {
          path: 'monitor',
          name: 'Monitor',
          component: () => import('@/views/ServiceMonitor.vue'),
        },
        {
          path: 'content-studio',
          name: 'ContentStudio',
          component: () => import('@/views/content-studio/ContentStudioList.vue'),
        },
        {
          path: 'content-studio/:sourceId',
          name: 'ContentStudioEditor',
          component: () => import('@/views/content-studio/ContentStudioEditor.vue'),
        },
      ],
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();
  if (to.meta.requiresAuth !== false && !authStore.isAuthenticated) {
    next('/login');
  } else {
    next();
  }
});

export default router;
