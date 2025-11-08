<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MultiStepLoader from '@/components/ui/MultiStepLoader.vue';
import type { Step } from '@/components/ui/MultiStepLoader.vue';

const route = useRoute();
const router = useRouter();

// 從路由參數獲取起點和終點信息
const origin = route.query.origin as string | undefined;
const destination = route.query.destination as string | undefined;

// MultiStepLoader 狀態
const isLoading = ref(false);
const analysisSteps = ref<Step[]>([
  {
    text: '行程路徑分析...',
    duration: 1500
  },
  {
    text: '天氣與空污資料蒐集...',
    duration: 2000
  },
  {
    text: '見車率與見位率分析...',
    duration: 2000
  },
  {
    text: 'AI預測目的地車位數量...',
    duration: 2000
  },
  {
    text: '適合度計算分析...',
    duration: 1500,
    afterText: '分析完成！'
  }
]);

// 處理 MultiStepLoader 完成事件
const handleAnalysisComplete = () => {
  console.log('分析完成！', { origin, destination });
  
  // 跳轉到分析結果頁面
  setTimeout(() => {
    isLoading.value = false;
    router.push({
      name: 'analysis-result',
      query: {
        origin: origin || '',
        destination: destination || '',
        originLat: route.query.originLat || '',
        originLng: route.query.originLng || '',
        destLat: route.query.destLat || '',
        destLng: route.query.destLng || ''
      }
    });
  }, 1000);
};

// 處理 MultiStepLoader 關閉事件
const handleAnalysisClose = () => {
  isLoading.value = false;
  router.push({ name: 'home' });
};

// 處理 MultiStepLoader 狀態變化
const handleAnalysisStateChange = (index: number) => {
  console.log(`當前分析步驟: ${index + 1}`);
};

// 組件掛載後自動開始載入
onMounted(() => {
  isLoading.value = true;
});
</script>

<template>
  <div class="h-screen w-screen">
    <!-- MultiStepLoader 組件 -->
    <MultiStepLoader
      :loading="isLoading"
      :steps="analysisSteps"
      :default-duration="1500"
      :prevent-close="true"
      @complete="handleAnalysisComplete"
      @close="handleAnalysisClose"
      @state-change="handleAnalysisStateChange"
    />
  </div>
</template>

<style scoped>
/* 如果需要自定義樣式可以添加 */
</style>

