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
        { path: '', name: 'Dashboard', component: () => import('@/views/Dashboard.vue') },
        { path: 'customers', name: 'Customers', component: () => import('@/views/customer/CustomerList.vue') },
        { path: 'customers/:id', name: 'CustomerDetail', component: () => import('@/views/customer/CustomerDetail.vue') },
        { path: 'tags', name: 'Tags', component: () => import('@/views/customer/TagManage.vue') },
        { path: 'sop', name: 'SopList', component: () => import('@/views/sop/SopList.vue') },
        { path: 'sop/create', name: 'SopCreate', component: () => import('@/views/sop/SopEdit.vue') },
        { path: 'sop/:id/edit', name: 'SopEdit', component: () => import('@/views/sop/SopEdit.vue') },
        { path: 'mass-task', name: 'MassTask', component: () => import('@/views/sop/MassTask.vue') },
      ],
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();
  if (to.meta.requiresAuth !== false && !authStore.isAuthenticated) next('/login');
  else next();
});

export default router;
