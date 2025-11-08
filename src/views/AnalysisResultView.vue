<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AqiUviInfoDialog from '@/components/ui/AqiUviInfoDialog.vue';
import WeatherAlertDialog from '@/components/ui/WeatherAlertDialog.vue';
import CarbonReductionInfoDialog from '@/components/ui/CarbonReductionInfoDialog.vue';
import CalorieInfoDialog from '@/components/ui/CalorieInfoDialog.vue';
import iconResultBike from '@/assets/images/icon-result-bike.svg';
import iconResultDest from '@/assets/images/icon-result-dest.svg';
import mascotIdeal from '@/assets/images/mascot-ideal.webp';
import mascotNormal from '@/assets/images/mascot-normal.webp';
import mascotAlert from '@/assets/images/mascot-alert.webp';
import resultRain from '@/assets/images/icon-result-rain.svg';
import resultSun from '@/assets/images/icon-result-sun.svg';
import resultAir from '@/assets/images/icon-result-air.svg';
import resultInfo from '@/assets/images/icon-result-info.svg';
import resultTime from '@/assets/images/icon-result-time.svg';
import resultCarbon from '@/assets/images/icon-result-carbon.svg';
import resultConstruction from '@/assets/images/icon-result-construction.svg';
import resultHeat from '@/assets/images/icon-result-heat.svg';
import weatherSun from '@/assets/images/icon-weather-sun.svg';
import weatherCloud from '@/assets/images/icon-weather-cloud.svg';
import weatherRain from '@/assets/images/icon-weather-rain.svg';
import weatherSunCloud from '@/assets/images/icon-weather-suncloud.svg';

const route = useRoute();
const router = useRouter();

// 從路由參數獲取起點和終點信息
const originName = computed(() => (route.query.origin as string) || '');
const destinationName = computed(() => (route.query.destination as string) || '');
const originLat = computed(() => parseFloat((route.query.originLat as string) || '0'));
const originLng = computed(() => parseFloat((route.query.originLng as string) || '0'));
const originNo = computed(() => (route.query.originNo as string) || '');
const destLat = computed(() => parseFloat((route.query.destLat as string) || '0'));
const destLng = computed(() => parseFloat((route.query.destLng as string) || '0'));
const destNo = computed(() => (route.query.destNo as string) || '');
const routesParam = computed(() => (route.query.routes as string) || '');

// 天氣與環境資料
const weatherData = ref({
  temperature: 24,
  precipitation: 10,
  aqi: 45,
  uvi: 3,
  isSunny: true,
  conditionLabel: ''
});

// 推薦標籤
interface RecommendationTag {
  content: string;
  level: string;
}
const recommendationTags = ref<RecommendationTag[]>([]);

// 適合度
const suitability = ref<string>('');

// 起始站資料
const originStation = ref({
  name: '',
  availableBikes: 0
});

// 起始站附近的站點資料
const nearbyStations = ref<Array<{
  station_name: string;
  station_no: string;
  distance: number;
}>>([]);

// 終點站資料
const destinationStation = ref({
  name: '',
  availableSpaces: 0
});

// 終點站附近的站點資料
const destinationNearbyStations = ref<Array<{
  station_name: string;
  station_no: string;
  distance: number;
}>>([]);

// 路線詳情
const routeDetails = ref({
  estimatedTime: 0, // 分鐘
  carbonReduction: 0, // 公斤
  caloriesBurned: 0, // 大卡
  roadConstruction: 0 // 件
});

// 空位預測資料
const vacancyPrediction = ref([
  { label: '目前', value: 0 },
  { label: '15分鐘後', value: 0 },
  { label: '30分鐘後', value: 0 },
  { label: '45分鐘後', value: 0 }
]);

// 計算柱狀圖的最大高度（用於視覺化）
const maxVacancy = computed(() => Math.max(...vacancyPrediction.value.map((v) => v.value), 1));

// AQI/UVI 說明區塊
const showInfoDialog = ref(false);

const openInfoDialog = () => {
  showInfoDialog.value = true;
};

// 減碳量說明區塊
const showCarbonReductionDialog = ref(false);

const openCarbonReductionDialog = () => {
  showCarbonReductionDialog.value = true;
};

// 消耗熱量說明區塊
const showCalorieDialog = ref(false);

const openCalorieDialog = () => {
  showCalorieDialog.value = true;
};

// 天氣特報資料
const weatherAlert = ref<{
  title: string;
  location: string;
  startTime: string;
  endTime: string;
} | null>(null);

// 天氣特報彈窗顯示狀態
const showWeatherAlert = ref(false);

// 存儲 routes 數據
const routesData = ref<any[] | null>(null);


// 返回上一頁（直接跳轉到 SurroundingServiceView，避免回到 loading 頁面）
const goBack = () => {
  router.push({ name: 'home' });
};

// 重新規劃
const replanRoute = () => {
  router.push({ name: 'home' });
};

// 跳轉到道路施工資訊頁面
const goToRoadConstruction = () => {
  const constructionMapUrl = 'https://dig.taipei/Tpdig/Map/ShowPublic.aspx';
  window.location.href = constructionMapUrl;
};

// 開始騎乘 - 跳轉到 Google Maps 路線規劃
const startRide = () => {
  // 獲取起點和終點站名
  const origin = originStation.value.name || '';
  const destination = destinationStation.value.name || '';
  
  // 如果沒有站名，無法跳轉
  if (!origin || !destination) {
    console.warn('缺少起點或終點站名，無法開啟 Google Maps');
    return;
  }
  
  // 構建 Google Maps 路線規劃 URL
  // 使用 encodeURIComponent 對站名進行編碼，確保 URL 正確
  const originEncoded = encodeURIComponent(origin);
  const destinationEncoded = encodeURIComponent(destination);
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originEncoded}&destination=${destinationEncoded}&travelmode=bicycling`;
  
  // 在新標籤頁中打開 Google Maps
  window.open(googleMapsUrl, '_blank');
};

// 根據適合度返回文字顏色
const suitabilityTextColor = computed(() => {
  if (suitability.value === '非常適合') {
    return 'text-[#76A732]';
  } else if (suitability.value === '適合') {
    return 'text-primary-500';
  } else {
    return 'text-orange-500';
  }
});

// 根據適合度返回 mascot 圖片
const mascotImage = computed(() => {
  if (suitability.value === '非常適合') {
    return mascotIdeal;
  } else if (suitability.value === '適合') {
    return mascotNormal;
  } else {
    return mascotAlert;
  }
});

// 根據天氣條件返回天氣圖標
const weatherIcon = computed(() => {
  const condition = weatherData.value.conditionLabel;
  if (condition && condition.includes('雨')) {
    return weatherRain;
  } else if (condition && condition.includes('多雲')) {
    return weatherSunCloud;
  } else if (condition && condition.includes('陰')) {
    return weatherCloud;
  } else if (condition && condition.includes('晴')) {
    return weatherSun;
  }
  // 默認返回晴天圖標
  return weatherCloud;
});

// 起始站選單資料（不包含當前選中的站點）
const originStationOptions = computed(() => {
  // 從 nearby_stations 轉換為選項格式
  const options = nearbyStations.value.map(station => ({
    name: station.station_name,
    no: station.station_no,
    distance: station.distance
  }));
  
  // 過濾掉當前選中的站點
  return options.filter(opt => opt.name !== originStation.value.name);
});

// 終點站選單資料（不包含當前選中的站點）
const destinationStationOptions = computed(() => {
  // 從 nearby_stations 轉換為選項格式
  const options = destinationNearbyStations.value.map(station => ({
    name: station.station_name,
    no: station.station_no,
    distance: station.distance
  }));
  
  // 過濾掉當前選中的站點
  return options.filter(opt => opt.name !== destinationStation.value.name);
});

// Select 元素引用
const originSelectRef = ref<HTMLSelectElement | null>(null);
const destinationSelectRef = ref<HTMLSelectElement | null>(null);

// 打開起始站選單
const openOriginSelect = () => {
  originSelectRef.value?.click();
};

// 打開終點站選單
const openDestinationSelect = () => {
  destinationSelectRef.value?.click();
};

// 選擇起始站
const selectOriginStation = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const selectedName = target.value;
  const station = originStationOptions.value.find(s => s.name === selectedName);
  if (station) {
    // 跳轉到 SurroundingServiceView，傳遞選中的起始站和當前的終點站
    const query: Record<string, string> = {
      origin: selectedName
    };
    if (station.no) {
      query.originNo = station.no;
    }
    // 同時傳遞當前的終點站信息
    if (destinationStation.value.name) {
      query.destination = destinationStation.value.name;
    }
    if (destNo.value) {
      query.destNo = destNo.value;
    }
    router.push({
      name: 'home',
      query
    });
  }
};

// 選擇終點站
const selectDestinationStation = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const selectedName = target.value;
  const station = destinationStationOptions.value.find(s => s.name === selectedName);
  if (station) {
    // 跳轉到 SurroundingServiceView，傳遞當前的起始站和選中的終點站
    const query: Record<string, string> = {
      destination: selectedName
    };
    if (station.no) {
      query.destNo = station.no;
    }
    // 同時傳遞當前的起始站信息
    if (originStation.value.name) {
      query.origin = originStation.value.name;
    }
    if (originNo.value) {
      query.originNo = originNo.value;
    }
    router.push({
      name: 'home',
      query
    });
  }
};

// 從路由 state 或 localStorage 讀取分析結果數據
const loadAnalysisData = () => {
  try {
    let data = null;
    
    // 優先從路由 state 讀取數據（更可靠，用於新分析）
    const routeState = history.state;
    if (routeState && routeState.analysisResultData) {
      data = routeState.analysisResultData;
      // 如果從路由 state 讀取到數據，同時保存到 localStorage（更新最後一次結果）
      try {
        localStorage.setItem('analysisResultData', JSON.stringify(data));
        localStorage.setItem('analysisResultDataTimestamp', Date.now().toString());
      } catch (error) {
        console.error('保存分析結果到 localStorage 失敗:', error);
      }
    } else {
      // 如果路由 state 沒有數據，從 localStorage 讀取（持久化存儲）
      let storedData = localStorage.getItem('analysisResultData');
      
      // 如果 localStorage 沒有，嘗試從 sessionStorage 讀取（向後兼容）
      if (!storedData) {
        storedData = sessionStorage.getItem('analysisResultData');
      }
      
      if (!storedData) {
        console.warn('沒有找到存儲的分析結果數據');
        return;
      }
      
      data = JSON.parse(storedData);
    }
    
    // 打印所有後端資料
    console.log('=== 後端給的所有資料 ===');
    console.log('完整資料:', data);
    console.log('完整資料 (JSON):', JSON.stringify(data, null, 2));
    
    // 更新天氣與環境資料
    if (data && data.weather_block) {
      weatherData.value = {
        temperature: parseFloat(data.weather_block.temperature) || 24,
        precipitation: parseFloat(data.weather_block.rain_probability) || 10,
        aqi: parseFloat(data.weather_block.aqi) || 45,
        uvi: data.weather_block.uvi === '-' ? 3 : parseFloat(data.weather_block.uvi) || 3,
        isSunny: data.weather_block.condition_label === '晴',
        conditionLabel: data.weather_block.condition_label || ''
      };
    }
    
    // 更新起始站資料
    if (data && data.origin_station_block) {
      originStation.value.name = data.origin_station_block.station_name || originStation.value.name;
      // available_bikes 寫入「目前可租借數量」
      const bikes = Number(data.origin_station_block.available_bikes);
      originStation.value.availableBikes = isNaN(bikes) ? 0 : bikes;
      // 讀取附近的站點資料
      if (data.origin_station_block.nearby_stations && Array.isArray(data.origin_station_block.nearby_stations)) {
        nearbyStations.value = data.origin_station_block.nearby_stations;
      }
    }
    
    // 更新終點站資料
    if (data && data.destination_station_block) {
      destinationStation.value.name = data.destination_station_block.station_name || destinationStation.value.name;
      // available_slots 寫入「目前空位數量」
      const slots = Number(data.destination_station_block.available_slots);
      destinationStation.value.availableSpaces = isNaN(slots) ? 0 : slots;
      // 讀取附近的站點資料
      if (data.destination_station_block.nearby_stations && Array.isArray(data.destination_station_block.nearby_stations)) {
        destinationNearbyStations.value = data.destination_station_block.nearby_stations;
      }
      // 更新空位預測資料 - "目前"使用 available_slots
      vacancyPrediction.value[0].value = isNaN(slots) ? 0 : slots;
    }
    
    // 更新推薦標籤
    if (data && data.label_block) {
      if (data.label_block.labels) {
        recommendationTags.value = data.label_block.labels.map((label: any) => ({
          content: label.content,
          level: label.level
        }));
      }
      // 讀取適合度
      if (data.label_block.suitability) {
        suitability.value = data.label_block.suitability;
      }
    }
    
    // 更新空位預測資料 - "15分鐘後"、"30分鐘後"、"45分鐘後" 使用 predictions 陣列中的三個值
    if (data && data.predictions && Array.isArray(data.predictions)) {
      const predictions = data.predictions;
      if (predictions.length >= 1) {
        vacancyPrediction.value[1].value = Number(predictions[0]) || 0;
      }
      if (predictions.length >= 2) {
        vacancyPrediction.value[2].value = Number(predictions[1]) || 0;
      }
      if (predictions.length >= 3) {
        vacancyPrediction.value[3].value = Number(predictions[2]) || 0;
      }
    }
    
    // 更新路線詳情資料
    if (data && data.route_analysis_block) {
      routeDetails.value.estimatedTime = Number(data.route_analysis_block.riding_time) || 0;
      routeDetails.value.carbonReduction = Number(data.route_analysis_block.carbon_reduction) || 0;
      routeDetails.value.caloriesBurned = Number(data.route_analysis_block.calories) || 0;
      routeDetails.value.roadConstruction = Number(data.route_analysis_block.construction_count) || 0;
    }
    
    // 檢查是否有天氣特報
    // 先重置狀態，避免重複觸發
    showWeatherAlert.value = false;
    
    if (data && data.weather_block && 
        data.weather_block.phenomena && 
        data.weather_block.phenomena !== '-' &&
        data.weather_block.start_time &&
        data.weather_block.start_time !== '-' &&
        data.weather_block.end_time &&
        data.weather_block.end_time !== '-') {
      // 先設置完整的 weatherAlert 數據
      weatherAlert.value = {
        title: data.weather_block.phenomena,
        location: '臺北市', // 可以從後端獲取或使用當前位置
        startTime: data.weather_block.start_time,
        endTime: data.weather_block.end_time
      };
      // 確保 weatherAlert 數據設置完成後，再在下一個 tick 顯示彈窗
      // 這樣可以避免彈窗在數據未完全準備好時就顯示
      nextTick(() => {
        // 再次確認 weatherAlert 有值，避免顯示空彈窗
        if (weatherAlert.value) {
          showWeatherAlert.value = true;
        }
      });
    } else {
      // 如果沒有天氣特報，確保清除舊數據
      weatherAlert.value = null;
    }
    
    // 不再清除 localStorage，保持數據持久化
    // 下次分析時會自動覆蓋舊數據
  } catch (error) {
    console.error('讀取分析結果數據失敗:', error instanceof Error ? error.message : String(error));
  }
};

onMounted(() => {
  // 從路由參數更新起始站資料（作為預設值）
  if (originName.value) {
    originStation.value.name = originName.value;
  }
  
  // 從路由參數更新終點站資料（作為預設值）
  if (destinationName.value) {
    destinationStation.value.name = destinationName.value;
  }
  
  // 讀取並保存 routes 參數
  if (routesParam.value) {
    try {
      // 如果 query 參數中有 routes，解碼並保存到 localStorage 持久化
      const decodedRoutes = decodeURIComponent(routesParam.value);
      const parsedRoutes = JSON.parse(decodedRoutes);
      routesData.value = parsedRoutes;
      console.log('=== AnalysisResultView 獲取到的 routes 數據 ===');
      console.log('routesParam.value (原始):', routesParam.value.substring(0, 100) + '...');
      console.log('decodedRoutes (解碼後):', decodedRoutes.substring(0, 200) + '...');
      console.log('routesData (解析後):', routesData.value);
      console.log('routesData 類型:', Array.isArray(routesData.value) ? 'Array' : typeof routesData.value);
      console.log('routesData.length:', Array.isArray(routesData.value) ? routesData.value.length : 'N/A');
      if (Array.isArray(routesData.value) && routesData.value.length > 0) {
        console.log('routesData[0]:', routesData.value[0]);
        console.log('routesData[0].legs:', routesData.value[0].legs);
        console.log('routesData[0].legs.length:', routesData.value[0].legs?.length);
      }
      // 保存到 localStorage，持久化存儲
      try {
        localStorage.setItem('routeData', decodedRoutes);
      } catch (error) {
        console.error('保存 routes 到 localStorage 失敗:', error);
        // 回退到 sessionStorage
        sessionStorage.setItem('routeData', decodedRoutes);
      }
    } catch (error) {
      console.error('保存 routes 參數失敗:', error);
    }
  } else {
    // 如果 query 參數中沒有 routes，嘗試從 localStorage 讀取
    let storedRoutes = localStorage.getItem('routeData');
    // 如果 localStorage 沒有，嘗試從 sessionStorage 讀取（向後兼容）
    if (!storedRoutes) {
      storedRoutes = sessionStorage.getItem('routeData');
    }
    if (storedRoutes) {
      try {
        const parsedRoutes = JSON.parse(storedRoutes);
        routesData.value = parsedRoutes;
        console.log('=== AnalysisResultView 從存儲獲取到的 routes 數據 ===');
        console.log('routesData:', routesData.value);
        console.log('routesData 類型:', Array.isArray(routesData.value) ? 'Array' : typeof routesData.value);
        console.log('routesData.length:', Array.isArray(routesData.value) ? routesData.value.length : 'N/A');
        if (Array.isArray(routesData.value) && routesData.value.length > 0) {
          console.log('routesData[0]:', routesData.value[0]);
        }
      } catch (error) {
        console.error('從存儲解析 routes 失敗:', error);
      }
    } else {
      console.warn('⚠️ AnalysisResultView: 沒有找到 routes 數據（query 參數和存儲都沒有）');
    }
  }
  
  // 從 sessionStorage 讀取分析結果數據
  loadAnalysisData();
});
</script>

<template>
  <div class="h-screen w-screen bg-grey-50 overflow-y-auto pb-24">
    <!-- 天氣與環境條件卡片 -->
    <div class="bg-white mx-4 mt-4 rounded-xl shadow-card p-4">
      <div class="flex items-center">
        <div class="flex items-center gap-3 flex-1">
          <!-- 天氣圖標 -->
          <div class="w-12 h-12 flex items-center justify-center">
            <img :src="weatherIcon" alt="天氣" class="w-12 h-12" />
          </div>
          <div class="flex flex-col gap-1 flex-1">
            <div class="text-2xl font-bold text-grey-900">{{ weatherData.temperature }} °C</div>
            <div class="flex items-center justify-between gap-2 text-sm text-grey-600">
              <div class="flex items-center gap-1.5">
                <span class="flex items-center gap-1">
                    <img :src="resultRain" alt="降雨" class="w-4 h-4" />
                    {{ weatherData.precipitation }}%
                </span>
                <div class="h-4 w-px bg-grey-300"></div>
                <span class="flex items-center gap-1">
                    <img :src="resultAir" alt="AQI" class="w-4 h-4" />
                    AQI {{ weatherData.aqi }}
                </span>
                <div class="h-4 w-px bg-grey-300"></div>
                <span class="flex items-center gap-1">
                    <img :src="resultSun" alt="UVI" class="w-4 h-4" />
                    UVI {{ weatherData.uvi }}
                </span>
              </div>
              <button
                @click="openInfoDialog"
                class="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                >
                <img :src="resultInfo" alt="info" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
      </div>
    </div>

    <!-- AQI/UVI 說明pop-up -->
    <AqiUviInfoDialog v-model="showInfoDialog" />

    <!-- 減碳量說明pop-up -->
    <CarbonReductionInfoDialog v-model="showCarbonReductionDialog" />

    <!-- 消耗熱量說明pop-up -->
    <CalorieInfoDialog v-model="showCalorieDialog" />

    <!-- 天氣特報pop-up -->
    <WeatherAlertDialog v-model="showWeatherAlert" :alert="weatherAlert" />

    <!-- 推薦部分 -->
    <div class="flex item-center justify-center py-3 mx-4 mt-4">
      <div class="flex-1 flex flex-col justify-start px-2 pl-5 gap-3">
        <div class="flex py-2 items-center">
            <div class="text-2xl font-extrabold mb-2" :class="suitabilityTextColor">{{ suitability}}</div>
            <div class="text-2xl font-extrabold text-[gray-900] mb-2">騎乘</div>
        </div>
        <div class="flex flex-col gap-2 justify-start items-start">
            <span
            v-for="tag in recommendationTags"
            :key="tag.content"
            class="px-4 py-2 rounded-lg text-sm font-medium"
            :class="
                tag.level === 'good'
                ? 'bg-[#E8F5E9] text-[#76A732]'
                : tag.level === 'normal'
                ? 'bg-primary-100 text-primary-600'
                : 'bg-orange-100 text-orange-600'
            "
            >
            {{ tag.content }}
            </span>
        </div>
      </div>
    <!-- image -->
      <img :src="mascotImage" alt="mascot" class="flex-1 w-1/2 max-w-[200px]">
    </div>

    <!-- 路線信息區域 -->
    <div class="mx-4 mt-6 mb-6 relative">
      <!-- 虛線連接線 -->
      <div
        class="absolute left-6 w-0.5 border-l-2 border-dashed border-primary-300"
        style="top: 0; bottom: 0"
      ></div>

      <!-- 起始站卡片 -->
      <div class="relative flex items-start gap-3 mb-4">
        <!-- 起始站圖標（自行車） -->
        <div
          class="w-12 h-12 rounded-full bg-primary-400 flex items-center justify-center flex-shrink-0 z-0 relative"
        >
          <img :src="iconResultBike" alt="起始站" class="w-6 h-6" />
        </div>
        <div class="flex-1 bg-white rounded-xl shadow-card px-4 py-3">
          <div class="flex items-center justify-between">
            <div>
                <div class="text-sm text-grey-300 text-extrabold">起始站</div>
                <div class="text-base font-extrabold text-grey-900">
                    {{ originStation.name }}
                </div>
            </div>
            <div class="relative">
              <button
                @click="openOriginSelect"
                class="px-3 py-1.5 bg-primary-100 text-primary-600 rounded-full text-sm font-medium flex items-center gap-1"
              >
                切換
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 9L12 15L18 9"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <select
                ref="originSelectRef"
                @change="selectOriginStation"
                :value="originStation.name"
                class="absolute inset-0 opacity-0 cursor-pointer"
              >
                <option
                  v-for="(station, index) in originStationOptions"
                  :key="index"
                  :value="station.name"
                >
                  {{ station.name }}  {{ station.distance }}m
                </option>
              </select>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <div class="text-sm text-grey-600">目前可租借數量</div>
              <div 
                class="text-2xl font-extrabold"
                :class="originStation.availableBikes <= 3 ? 'text-secondary-500' : 'text-primary-500'"
              >
                {{ originStation.availableBikes }}
              </div>
            </div>
            
          </div>
        </div>
      </div>

      <!-- 路線詳情卡片 -->
      <div class="relative ml-15 mb-4 bg-primary-100 rounded-xl p-3">
        <div class="grid grid-cols-2 gap-2.5">
          <!-- 預估時間 -->
          <div class="flex items-center gap-2">
            <img :src="resultTime" alt="time" class="w-6 h-6">
            <div class="flex flex-col items-start">
              <span class="text-sm text-grey-300">預估時間</span>
              <div class="text-xl font-extrabold">
                <span class="text-base text-primary-500">{{ routeDetails.estimatedTime }}</span>
                <span class="text-base text-grey-900"> 分鐘</span>
              </div>
            </div>
          </div>

          <!-- 減碳量 -->
          <div class="flex items-center gap-2">
           <img :src="resultCarbon" alt="carbon" class="w-6 h-6">
            <div class="flex flex-col items-start">
              <div class="flex items-center gap-1">
                <span class="text-sm text-grey-300">減碳量</span>
              </div>
              <div class="flex items-center gap-1 text-xl font-extrabold">
                <span class="text-base text-primary-500">{{ routeDetails.carbonReduction * 1000 }}</span>
                <span class="text-base text-grey-900 whitespace-nowrap">公克</span>
                <button 
                  @click="openCarbonReductionDialog"
                  class="w-4 h-4 rounded-full flex items-center justify-center text-grey-300 hover:text-grey-500 transition-colors cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M10.8333 5.83333C10.8333 6.29357 10.4602 6.66667 9.99999 6.66667C9.53975 6.66667 9.16666 6.29357 9.16666 5.83333C9.16666 5.3731 9.53975 5 9.99999 5C10.4602 5 10.8333 5.3731 10.8333 5.83333Z" fill="currentColor"/>
                    <path d="M10 14.1666V8.33325" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- 消耗熱量 -->
          <div class="flex items-center gap-2">
           <img :src="resultHeat" alt="heat" class="w-6 h-6">
            <div class="flex flex-col items-start">
              <span class="text-sm text-grey-300">消耗熱量</span>
              <div class="flex items-center text-xl font-extrabold gap-1 whitespace-nowrap">
                <span class="text-base text-primary-500">{{ routeDetails.caloriesBurned }}</span>
                <span class="text-base text-grey-900"> 大卡</span>
                <button 
                  @click="openCalorieDialog"
                  class="w-4 h-4 rounded-full flex items-center justify-center text-grey-300 hover:text-grey-500 transition-colors cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M10.8333 5.83333C10.8333 6.29357 10.4602 6.66667 9.99999 6.66667C9.53975 6.66667 9.16666 6.29357 9.16666 5.83333C9.16666 5.3731 9.53975 5 9.99999 5C10.4602 5 10.8333 5.3731 10.8333 5.83333Z" fill="currentColor"/>
                    <path d="M10 14.1666V8.33325" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- 道路施工 -->
          <div class="flex items-center gap-2">
            <img :src="resultConstruction" alt="construction" class="w-6 h-6">
            <div class="flex flex-col items-start">
              <div class="flex items-center gap-1">
                <span class="text-sm text-grey-300">道路施工</span>         
              </div>
              <div class="flex items-center gap-1 text-xl font-extrabold">
                <span class="text-base text-primary-500">{{ routeDetails.roadConstruction }}</span>
                <span class="text-base text-grey-900 whitespace-nowrap"> 件</span>
                <button
                  @click="goToRoadConstruction"
                  class="w-4 h-4 rounded-full flex items-center justify-center text-grey-300 hover:text-grey-500 transition-colors cursor-pointer"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M18 13V19A2 2 0 0 1 16 21H5A2 2 0 0 1 3 19V8A2 2 0 0 1 5 6H10"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M15 3H21V9"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M10 14L21 3"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 終點站卡片 -->
      <div class="relative flex items-start gap-3 mb-2">
        <!-- 終點站圖標（目的地） -->
        <div
          class="w-12 h-12 rounded-full bg-primary-400 flex items-center justify-center flex-shrink-0 z-0 relative"
        >
          <img :src="iconResultDest" alt="終點站" class="w-6 h-6" />
        </div>
        <div class="flex-1 bg-white rounded-xl shadow-card px-4 py-3">
          <div class="flex items-center justify-between">
            <div>
                <div class="text-sm text-grey-300 text-extrabold">終點站</div>
                <div class="text-base font-extrabold text-grey-900">
                    {{ destinationStation.name }}
                </div>
            </div>
            <div class="relative">
              <button
                @click="openDestinationSelect"
                class="px-3 py-1.5 bg-primary-100 text-primary-600 rounded-full text-sm font-medium flex items-center gap-1"
              >
                切換
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 9L12 15L18 9"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <select
                ref="destinationSelectRef"
                @change="selectDestinationStation"
                :value="destinationStation.name"
                class="absolute inset-0 opacity-0 cursor-pointer"
              >
                <option
                  v-for="(station, index) in destinationStationOptions"
                  :key="index"
                  :value="station.name"
                >
                  {{ station.name }}  {{ station.distance }}m
                </option>
              </select>
            </div>
          </div>
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-1.5">
              <div class="text-sm text-grey-600">目前空位數量</div>
              <div 
                class="text-2xl font-extrabold"
                :class="destinationStation.availableSpaces <= 3 ? 'text-secondary-500' : 'text-primary-500'"
              >
                {{ destinationStation.availableSpaces }}
              </div>
            </div>
          </div>

          <!-- 空位預測圖表 -->
          <div class="mt-4 pt-4 border-t border-grey-200">
            <div class="text-bold text-center font-extrabold text-grey-900 mb-3">空位預測</div>
            <div class="flex items-end justify-between gap-2.5">
              <div
                v-for="(item, index) in vacancyPrediction"
                :key="index"
                class="flex-1 flex flex-col items-center"
              >
                <div class="text-xs font-bold text-primary-500 mb-1">{{ item.value }}</div>
                <div
                  class="w-full px-2.5"
                  :style="{ height: `${(item.value / maxVacancy) * 100}px` }"
                >
                  <div class="w-full h-full rounded bg-gradient-to-t from-primary-500 to-primary-100"></div>
                </div>
                <div class="text-[10px] text-grey-600 mt-2 text-center">{{ item.label }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作欄 -->
    <div
      class="flex fixed bottom-0 left-0 right-0 bg-white border-t border-grey-200 px-4 py-4 flex items-center justify-between z-50"
    >
      <button @click="replanRoute" class="flex-[1.5] text-warn-200 font-medium">重新規劃</button>
      <button
        @click="startRide"
        class="flex-[2] bg-primary-100 text-primary-500 px-12 py-3 rounded-lg font-bold flex items-center justify-center gap-3 shadow-lg hover:opacity-90 transition-opacity"
      >
        <div class="w-6 h-6 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M17.3082 3.06348C17.7121 3.06348 18.1069 3.18325 18.4427 3.40764C18.7786 3.63203 19.0403 3.95097 19.1949 4.32413C19.3495 4.69728 19.3899 5.10789 19.3111 5.50402C19.2323 5.90016 19.0378 6.26403 18.7522 6.54963C18.4666 6.83523 18.1027 7.02973 17.7066 7.10852C17.3105 7.18732 16.8999 7.14688 16.5267 6.99231C16.1535 6.83775 15.8346 6.576 15.6102 6.24017C15.3858 5.90435 15.2661 5.50952 15.2661 5.10562C15.2661 4.56401 15.4812 4.04458 15.8642 3.66161C16.2472 3.27863 16.7666 3.06348 17.3082 3.06348Z"
              fill="currentColor"
            />
            <path
              d="M15.2664 18.3798C15.2678 17.297 15.6983 16.2588 16.464 15.4932C17.2297 14.7275 18.2679 14.2968 19.3507 14.2955C20.4339 14.2955 21.4725 14.7257 22.2384 15.4917C23.0044 16.2576 23.435 17.2966 23.435 18.3798C23.435 19.463 23.0044 20.5018 22.2384 21.2677C21.4725 22.0337 20.4339 22.4641 19.3507 22.4641C18.2679 22.4627 17.2297 22.0319 16.464 21.2662C15.6983 20.5006 15.2678 19.4626 15.2664 18.3798ZM17.3086 18.3798C17.3086 18.9214 17.5229 19.4408 17.9059 19.8238C18.2888 20.2067 18.8091 20.4219 19.3507 20.4219C19.8923 20.4219 20.4116 20.2067 20.7946 19.8238C21.1776 19.4408 21.3929 18.9214 21.3929 18.3798C21.3929 17.8382 21.1776 17.3188 20.7946 16.9358C20.4116 16.5528 19.8923 16.3376 19.3507 16.3376C18.8091 16.3376 18.2888 16.5528 17.9059 16.9358C17.5229 17.3188 17.3086 17.8382 17.3086 18.3798ZM0.971436 18.3798C0.972787 17.297 1.40334 16.2588 2.169 15.4932C2.93466 14.7275 3.97292 14.2968 5.05572 14.2955C6.13894 14.2955 7.17749 14.7257 7.94344 15.4917C8.70939 16.2576 9.14001 17.2966 9.14001 18.3798C9.14001 19.463 8.70939 20.5018 7.94344 21.2677C7.17749 22.0337 6.13894 22.4641 5.05572 22.4641C3.97292 22.4627 2.93466 22.0319 2.169 21.2662C1.40334 20.5006 0.972787 19.4626 0.971436 18.3798ZM3.01358 18.3798C3.01358 18.9214 3.22789 19.4408 3.61087 19.8238C3.99384 20.2067 4.51411 20.4219 5.05572 20.4219C5.59733 20.4219 6.11661 20.2067 6.49958 19.8238C6.88256 19.4408 7.09787 18.9214 7.09787 18.3798C7.09787 17.8382 6.88256 17.3188 6.49958 16.9358C6.11661 16.5528 5.59733 16.3376 5.05572 16.3376C4.51411 16.3376 3.99384 16.5528 3.61087 16.9358C3.22789 17.3188 3.01358 17.8382 3.01358 18.3798ZM11.1822 19.4008V15.7403L8.41908 12.9773C8.31779 12.8759 8.23893 12.7543 8.18774 12.6204C8.13655 12.4865 8.11415 12.3434 8.12193 12.2002C8.12971 12.0568 8.16699 11.9167 8.23261 11.7889C8.29824 11.6612 8.39079 11.5488 8.50284 11.459L13.6082 7.37471C13.7186 7.28568 13.8462 7.22055 13.9831 7.18363C14.1201 7.14671 14.2627 7.13873 14.4029 7.1602C14.5426 7.18232 14.6768 7.23331 14.7958 7.30977C14.9148 7.38623 15.0168 7.48655 15.0949 7.60442L16.83 10.2142H19.3487C19.6195 10.2142 19.8792 10.3218 20.0707 10.5133C20.2622 10.7048 20.3698 10.9645 20.3698 11.2353C20.3698 11.5061 20.2622 11.7658 20.0707 11.9573C19.8792 12.1488 19.6195 12.2563 19.3487 12.2563H16.2855C16.1174 12.2562 15.9511 12.2148 15.8029 12.1353C15.6547 12.0559 15.5291 11.941 15.436 11.801L14.013 9.66489L10.6656 12.3401L12.9232 14.5987C13.0185 14.693 13.0932 14.8053 13.1445 14.929C13.1959 15.0528 13.2229 15.1855 13.2223 15.3195V19.4038C13.2223 19.6746 13.1146 19.9344 12.9232 20.1259C12.7317 20.3174 12.472 20.4249 12.2012 20.4249C12.0671 20.4246 11.9342 20.398 11.8104 20.3464C11.6865 20.2948 11.5739 20.2193 11.4793 20.1241C11.3847 20.029 11.3089 19.9162 11.2579 19.7921C11.2069 19.668 11.1818 19.535 11.1822 19.4008Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <span>開始騎乘</span>
      </button>
    </div>
  </div>

</template>

<style lang="postcss" scoped>
.ml-15 {
  margin-left: 3.75rem; /* 60px */
}

</style>


