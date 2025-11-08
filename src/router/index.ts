import { createRouter, createWebHistory } from 'vue-router';
import SurroundingServiceView from '../views/SurroundingServiceView.vue';
import AnalysisLoadingView from '../views/AnalysisLoadingView.vue';
import AnalysisResultView from '../views/AnalysisResultView.vue';

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
        title: '騎妙 RideFlow'
      },
      component: SurroundingServiceView
    },
    {
      path: '/analysis-loading',
      name: 'analysis-loading',
      meta: {
        title: '分析中...'
      },
      component: AnalysisLoadingView
    },
    {
      path: '/analysis-result',
      name: 'analysis-result',
      meta: {
        title: '分析結果'
      },
      component: AnalysisResultView
    }
  ]
});

// 導航守衛，用來動態修改標題
router.beforeEach((to, from, next) => {
  const defaultTitle = '城市通'; // 預設標題
  document.title = (to.meta.title as string) || defaultTitle;
  next();
});

export default router;
