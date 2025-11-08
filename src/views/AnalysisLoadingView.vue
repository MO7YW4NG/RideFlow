<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import MultiStepLoader from '@/components/ui/MultiStepLoader.vue';
import type { Step } from '@/components/ui/MultiStepLoader.vue';

const route = useRoute();
const router = useRouter();

// 從路由參數獲取起點和終點信息
const origin = route.query.origin as string | undefined;
const destination = route.query.destination as string | undefined;
const originLat = route.query.originLat as string | undefined;
const originLng = route.query.originLng as string | undefined;
const originNo = route.query.originNo as string | undefined;
const destLat = route.query.destLat as string | undefined;
const destLng = route.query.destLng as string | undefined;
const destNo = route.query.destNo as string | undefined;

// API 數據
const apiData = ref<any>(null);
const apiError = ref<Error | null>(null);

// MultiStepLoader 狀態
const isLoading = ref(false);
const analysisSteps = ref<Step[]>([
  {
    text: '行程路徑分析...',
    duration: 1000
  },
  {
    text: '天氣與空污資料蒐集...',
    duration: 1000
  },
  {
    text: '見車率與見位率分析...',
    duration: 1000
  },
  {
    text: 'AI預測目的地車位數量...',
    duration: 1000
  },
  {
    text: '適合度計算分析...',
    duration: 1500,
    afterText: '分析完成！',
    async: true // 最後一步設為異步，等待 API 返回
  }
]);

// 從後端獲取分析結果數據
const fetchAnalysisData = async () => {
  try {
    console.log('=== 開始獲取分析結果數據 ===');
    
    // 構建請求參數
    const requestData = {
      origin: origin || '',
      destination: destination || '',
      originLat: originLat || '',
      originLng: originLng || '',
      originNo: originNo || '',
      destLat: destLat || '',
      destLng: destLng || '',
      destNo: destNo || ''
    };
    
    console.log('請求參數:', requestData);
    
    // POST 請求，參數在請求體中
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const apiUrl = `${backendUrl}route/analysis`;
    console.log('後端 URL:', backendUrl);
    console.log('API URL:', apiUrl);
    
    const response = await axios.post(apiUrl, requestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('API 響應狀態:', response.status);
    console.log('API 響應數據:', response.data);
    
    const data = response.data;
    apiData.value = data;
    
    // 將數據存儲到 sessionStorage 作為備份，供 AnalysisResultView 使用
    sessionStorage.setItem('analysisResultData', JSON.stringify(data));
    // 同時存儲時間戳，用於驗證數據有效性
    sessionStorage.setItem('analysisResultDataTimestamp', Date.now().toString());
    
    console.log('=== 數據獲取完成 ===');
    console.log('數據已存儲到 sessionStorage');
    
    // API 返回後，將最後一步的 async 設為 false，觸發完成
    // 使用 nextTick 確保響應式更新能夠正確觸發
    await nextTick();
    const lastStepIndex = analysisSteps.value.length - 1;
    if (analysisSteps.value[lastStepIndex]) {
      // 創建新的步驟對象以確保響應式更新
      const updatedSteps = [...analysisSteps.value];
      updatedSteps[lastStepIndex] = {
        ...updatedSteps[lastStepIndex],
        async: false
      };
      analysisSteps.value = updatedSteps;
    }
    
  } catch (error) {
    console.error('=== 獲取分析結果數據失敗 ===');
    console.error('錯誤訊息:', error instanceof Error ? error.message : String(error));
    
    apiError.value = error instanceof Error ? error : new Error(String(error));
    
    // 即使出錯，也要完成 loading
    await nextTick();
    const lastStepIndex = analysisSteps.value.length - 1;
    if (analysisSteps.value[lastStepIndex]) {
      // 創建新的步驟對象以確保響應式更新
      const updatedSteps = [...analysisSteps.value];
      updatedSteps[lastStepIndex] = {
        ...updatedSteps[lastStepIndex],
        async: false
      };
      analysisSteps.value = updatedSteps;
    }
  }
};

// 處理 MultiStepLoader 完成事件
const handleAnalysisComplete = () => {
  console.log('分析完成！', { origin, destination });
  console.log('準備跳轉到結果頁面，數據狀態:', {
    hasApiData: !!apiData.value,
    hasSessionStorage: !!sessionStorage.getItem('analysisResultData')
  });
  
  // 跳轉到分析結果頁面，通過 state 傳遞數據
  // 使用 replace 而不是 push，避免 loading 頁面留在歷史記錄中
  setTimeout(() => {
    isLoading.value = false;
    router.replace({
      name: 'analysis-result',
      query: {
        origin: origin || '',
        destination: destination || '',
        originLat: originLat || '',
        originLng: originLng || '',
        originNo: originNo || '',
        destLat: destLat || '',
        destLng: destLng || '',
        destNo: destNo || ''
      },
      state: {
        analysisResultData: apiData.value
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

// 組件掛載後自動開始載入和 API 調用
onMounted(() => {
  // 同時開始 loading 動畫和 API 調用
  isLoading.value = true;
  fetchAnalysisData();
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

