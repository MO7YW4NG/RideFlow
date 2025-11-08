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
const routesParam = route.query.routes as string | undefined;
const gender = (route.query.gender as string) || 'M';

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
    // 解析 routes 參數
    let routesData = null;
    if (routesParam) {
      try {
        const decodedRoutes = decodeURIComponent(routesParam);
        routesData = JSON.parse(decodedRoutes);
      } catch (error) {
        // 如果 query 參數解析失敗，嘗試從 localStorage 讀取
        const storedRoutes = localStorage.getItem('routeData');
        if (storedRoutes) {
          try {
            routesData = JSON.parse(storedRoutes);
          } catch (e) {
            console.error('從 localStorage 解析 routes 失敗:', e);
          }
        }
      }
    } else {
      // 如果 query 參數中沒有 routes，嘗試從 localStorage 讀取
      const storedRoutes = localStorage.getItem('routeData');
      if (storedRoutes) {
        try {
          routesData = JSON.parse(storedRoutes);
        } catch (e) {
          console.error('從 localStorage 解析 routes 失敗:', e);
        }
      }
    }
    
    // 構建請求參數
    const requestData: any = {
      origin: origin || '',
      destination: destination || '',
      originLat: originLat || '',
      originLng: originLng || '',
      originNo: originNo || '',
      destLat: destLat || '',
      destLng: destLng || '',
      destNo: destNo || '',
      gender: gender
    };
    
    // 如果有 routes 數據，添加到請求參數中
    if (routesData) {
      requestData.routes = routesData;
    }
    
    // POST 請求，參數在請求體中
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const apiUrl = `${backendUrl}route/analysis`;
    
    const response = await axios.post(apiUrl, requestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = response.data;
    apiData.value = data;
    
    // 將數據存儲到 localStorage，持久化保存最後一次分析結果
    // 下次分析時會自動覆蓋舊數據
    try {
      localStorage.setItem('analysisResultData', JSON.stringify(data));
      localStorage.setItem('analysisResultDataTimestamp', Date.now().toString());
    } catch (error) {
      console.error('保存分析結果到 localStorage 失敗:', error);
      // 如果 localStorage 存儲失敗（可能是存儲空間不足），回退到 sessionStorage
      sessionStorage.setItem('analysisResultData', JSON.stringify(data));
      sessionStorage.setItem('analysisResultDataTimestamp', Date.now().toString());
    }
    
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
    console.error('獲取分析結果數據失敗:', error instanceof Error ? error.message : String(error));
    
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
  // 跳轉到分析結果頁面，通過 state 傳遞數據
  // 使用 replace 而不是 push，避免 loading 頁面留在歷史記錄中
  setTimeout(() => {
    isLoading.value = false;
    
    // 構建 query 參數
    const queryParams: Record<string, string> = {
      origin: origin || '',
      destination: destination || '',
      originLat: originLat || '',
      originLng: originLng || '',
      originNo: originNo || '',
      destLat: destLat || '',
      destLng: destLng || '',
      destNo: destNo || '',
      gender: gender
    };
    
    // 如果有 routes 參數，也傳遞過去
    if (routesParam) {
      queryParams.routes = routesParam;
    }
    
    router.replace({
      name: 'analysis-result',
      query: queryParams,
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
  // 狀態變化處理（如需要可添加邏輯）
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

