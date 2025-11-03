import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import SurroundingServiceView from '../views/SurroundingServiceView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    return { top: 0 };
  },
  routes: [
    {
      path: '/',
      name: 'home',
      meta: {
        title: '申辦服務'
      },
      component: SurroundingServiceView
    }
    // {
    //   path: '/surrounding-service',
    //   name: 'surrounding-service',
    //   meta: {
    //     title: '周邊服務'
    //   },
    //   component: SurroundingServiceView
    // }
  ]
});

// 導航守衛，用來動態修改標題
router.beforeEach((to, from, next) => {
  const defaultTitle = '城市通'; // 預設標題
  document.title = (to.meta.title as string) || defaultTitle;
  next();
});

export default router;
