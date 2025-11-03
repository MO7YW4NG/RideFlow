<script setup lang="ts">
import FindPlace, { type Place } from '@/components/molecules/FindPlace.vue';
import SpotList from '@/components/organisms/SpotListView.vue';
import SpotDetail from '@/components/organisms/SpotDetailView.vue';
import MessageModal from '@/components/molecules/MessageModal.vue';
import BaseInput from '@/components/atoms/BaseInput.vue';
import BaseButton from '@/components/atoms/BaseButton.vue';
import CollapseItem from '@/components/molecules/CollapseItem.vue';
import BaseDialog from '@/components/atoms/BaseDialog.vue';
import { useGoogleMapsStore } from '@/stores/googleMaps';
import { useTripStore } from '@/stores/trip';
import type { HistoryTrip, ShortcutTrip, SavedTrip } from '@/stores/trip';
import axios from 'axios';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { disableBodyScroll, enableBodyScroll } from 'body-scroll-lock';
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import greenDotIconUrl from '/public/images/map/youbike/mappin-green.svg';
import defaultFocusIconUrl from '/public/images/map/icon_mappin-garbagetruck-green-pressed.svg';
import { mappingFormatter, getNestedValue } from '@/utils/spot-formatter';

export interface Spot {
  id: string;
  /** 站點名稱 */
  name: string;
  /** 行政區 */
  area: string;
  /** 地址 */
  address: string;
  /** 經度 */
  lat: number;
  /** 緯度 */
  lng: number;
  /** 距離 */
  distance?: number;
  /** 詳細資訊 */
  service_infos?: {
    title: string;
    value: { title: string; value: string }[] | string;
  }[];

  /** 其餘詳細資訊 */
  [key: string]: any;
}

const googleMapsStore = useGoogleMapsStore();
const tripStore = useTripStore();

const selectedSearchData = ref<Place>({
  id: '',
  name: '',
  icon: '',
  agency: '',
  type: '',
  request_url: '',
  data_path: ''
});

/** 搜尋結果 */
const searchSpotList = ref<Spot[]>([]);
/** 視窗下搜尋結果 */
const filteredSpotList = ref<Spot[]>([]);
const selectedSpot = ref<Spot | null>(null);

/** 是否展開找地點面板 */
const isExpand = ref(false);
/** 是否點選展開列表 */
const isExpandList = ref(false);
/** 是否點選展開明細 */
const isExpandDetail = ref(false);
const isFrom = ref<'spot' | 'list' | ''>('');

let isMapReady = ref(false);

let map: any = null;
/** 使用者定位 */
let marker: any = null;
let markers: google.maps.Marker[] = [];
let markerCluster: any = null;
let directionsService: google.maps.DirectionsService | null = null;
let directionsRenderer: google.maps.DirectionsRenderer | null = null;

// 起點/目的地輸入與資料
const originInput = ref('');
const destinationInput = ref('');
const originPlace = ref<{ name: string; lat?: number; lng?: number; address?: string } | null>(
  null
);
const destinationPlace = ref<{ name: string; lat?: number; lng?: number; address?: string } | null>(
  null
);
const originInputEl = ref<HTMLInputElement | null>(null);
const destinationInputEl = ref<HTMLInputElement | null>(null);

// 新增常用行程 Dialog 狀態
const showFavoriteDialog = ref(false);
const newFavoriteName = ref('');
const pinToHome = ref(false);
const activeList = ref<'history' | 'favorite'>('history');
const editingFavorite = ref<SavedTrip | null>(null);

const saveFavorite = () => {
  if (!newFavoriteName.value) return;
  if (editingFavorite.value) {
    // 編輯：只更新名稱與 pinToHome；起迄若有新選取也覆蓋
    tripStore.updateFavorite({
      ...editingFavorite.value,
      name: newFavoriteName.value,
      origin: originPlace.value || editingFavorite.value.origin,
      destination: destinationPlace.value || editingFavorite.value.destination,
      pinToHome: pinToHome.value
    });
  } else {
    // 新增
    tripStore.addFavorite({
      id: '',
      name: newFavoriteName.value,
      origin: originPlace.value,
      destination: destinationPlace.value,
      pinToHome: pinToHome.value
    });
  }
  showFavoriteDialog.value = false;
  newFavoriteName.value = '';
  pinToHome.value = false;
  editingFavorite.value = null;
};

/**
 * 目前位置
 */
const currentLocation = ref<{ lat: number; lng: number; results: any[] }>({
  // 預設經緯度在信義區附近
  lat: 25.0325917,
  lng: 121.5624999,
  results: []
});

/**
 * 是否顯示未開啟取用位置權限通知
 */
let isShowGeoError = ref(false);

onMounted(() => {
  initMap(currentLocation.value.lat, currentLocation.value.lng);
  setSheetSizes();
});

const handleExpandChange = (newValue: boolean) => {
  isExpand.value = newValue;
};

const handleSearchChange = async (data: Place) => {
  if (!data) {
    return;
  }
  console.log('handleSearchChange:', data);
  searchSpotList.value = [];
  selectedSearchData.value = data;

  switch (data.data_type) {
    case 'api':
    case 'json':
      searchSpotList.value = await fetchAndFormatData(
        data.request_url,
        mappingFormatter,
        data.format_fields,
        data.service_infos,
        data.data_path
      );
      break;
    case 'csv':
      break;
    default:
      break;
  }

  console.log('searchSpotList:', searchSpotList.value);
};

const setMapHeight = () => {
  const mapElement = document.getElementById('map');
  if (mapElement) {
    mapElement.style.height = `${window.innerHeight - 88}px`;
  }
};

// Bottom Sheet: sizes & drag behavior
const sheetRef = ref<HTMLElement | null>(null);
const sheetHeight = ref(0);
const sheetMin = ref(240); // 收合高度（提高）
const sheetMid = ref(0); // 視窗 45%
const sheetMax = ref(0); // 視窗 85%
const isDraggingSheet = ref(false);
let dragStartY = 0;
let dragStartHeight = 0;

const setSheetSizes = () => {
  sheetMid.value = Math.round(window.innerHeight * 0.45);
  sheetMax.value = Math.round(window.innerHeight * 0.85);
  // 初始化高度：至少為最小高度或中段（取較大者）
  if (!sheetHeight.value) sheetHeight.value = Math.max(sheetMin.value, sheetMid.value);
  // 若當前高度小於最小高度，立即提到最小高度
  if (sheetHeight.value < sheetMin.value) sheetHeight.value = sheetMin.value;
};

const onSheetDragStart = (clientY: number) => {
  isDraggingSheet.value = true;
  dragStartY = clientY;
  dragStartHeight = sheetHeight.value;
  document.body.style.userSelect = 'none';
};
const onSheetDragMove = (clientY: number) => {
  if (!isDraggingSheet.value) return;
  const delta = dragStartY - clientY; // 向上拖曳為正
  let next = dragStartHeight + delta;
  next = Math.max(sheetMin.value, Math.min(sheetMax.value, next));
  sheetHeight.value = next;
};
const onSheetDragEnd = () => {
  if (!isDraggingSheet.value) return;
  isDraggingSheet.value = false;
  document.body.style.userSelect = '';
  // 吸附到最近的段位
  const distances = [sheetMin.value, sheetMid.value, sheetMax.value]
    .map((h) => ({ h, d: Math.abs(h - sheetHeight.value) }))
    .sort((a, b) => a.d - b.d);
  sheetHeight.value = distances[0].h;
};

const onHandleMouseDown = (e: MouseEvent) => onSheetDragStart(e.clientY);
const onHandleMouseMove = (e: MouseEvent) => onSheetDragMove(e.clientY);
const onHandleTouchStart = (e: TouchEvent) => onSheetDragStart(e.touches[0].clientY);
const onHandleTouchMove = (e: TouchEvent) => onSheetDragMove(e.touches[0].clientY);

window.addEventListener('mousemove', onHandleMouseMove);
window.addEventListener('mouseup', onSheetDragEnd);
window.addEventListener('touchmove', onHandleTouchMove);
window.addEventListener('touchend', onSheetDragEnd);
window.addEventListener('resize', () => {
  setMapHeight();
  setSheetSizes();
});

// 鎖定背景捲動：面板在中段/全展時鎖住 body，收合時解除
watch(sheetHeight, (h) => {
  const target = sheetRef.value as HTMLElement | null;
  if (!target) return;
  if (h > sheetMin.value + 10) {
    disableBodyScroll(target, { reserveScrollBarGap: true });
  } else {
    enableBodyScroll(target);
  }
});

onUnmounted(() => {
  const target = sheetRef.value as HTMLElement | null;
  if (target) enableBodyScroll(target);
});

/**
 * 初始化地圖
 * @param lat 緯度
 * @param lng 經度
 */
const initMap = (lat: number, lng: number) => {
  googleMapsStore.loader.load().then(async () => {
    const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;
    await google.maps.importLibrary('places');

    map = new Map(document.getElementById('map') as HTMLElement, {
      // 設定地圖的中心點經緯度位置
      center: { lat, lng },
      // 設定地圖縮放比例 0-20
      zoom: 13,
      // 限制使用者能縮放地圖的最大比例
      maxZoom: 20,
      // 限制使用者能縮放地圖的最小比例
      minZoom: 3,
      // 設定是否呈現右下角街景小人
      streetViewControl: false,
      // 設定是否讓使用者可以切換地圖樣式：一般、衛星圖等
      mapTypeControl: false,
      fullscreenControl: false,
      zoomControl: false,
      // 替換成您的 MAP ID
      mapId: ''
    });

    // init marker
    marker = new google.maps.Marker({
      position: {
        lat,
        lng
      },
      map,
      title: 'your location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#4285F4',
        fillOpacity: 1,
        scale: 8, // 控制大小
        strokeColor: 'white',
        strokeWeight: 2
      }
    });

    // get current location
    getPositionClick();

    // 在地圖的dragend事件上使用該函數
    map.addListener('dragend', function () {
      updateMarkers();
    });

    // // 在地圖的zoom_changed事件上使用該函數
    map.addListener('zoom_changed', function () {
      updateMarkers();
    });

    isMapReady.value = true;
    setMapHeight();
    window.addEventListener('resize', setMapHeight);

    // Directions service/renderer
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });
    directionsRenderer.setMap(map);

    // Places Autocomplete for origin/destination
    if (originInputEl.value) {
      const ac = new google.maps.places.Autocomplete(originInputEl.value!, {
        fields: ['geometry', 'name', 'formatted_address']
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place || !place.geometry || !place.geometry.location) return;
        originPlace.value = {
          name: place.name || place.formatted_address || originInput.value,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address
        };
        originInput.value = originPlace.value.name;
        tryRoute();
      });
    }

    if (destinationInputEl.value) {
      const ac = new google.maps.places.Autocomplete(destinationInputEl.value!, {
        fields: ['geometry', 'name', 'formatted_address']
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place || !place.geometry || !place.geometry.location) return;
        destinationPlace.value = {
          name: place.name || place.formatted_address || destinationInput.value,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address
        };
        destinationInput.value = destinationPlace.value.name;
        tryRoute();
      });
    }
  });
};

const getPositionClick = () => {
  googleMapsStore
    .gettingPosition()!!
    .then((position: any) => successCallback(position))
    .catch((error) => errorCallback(error));
};

const successCallback = (position: GeolocationPosition) => {
  currentLocation.value.lat = position.coords.latitude;
  currentLocation.value.lng = position.coords.longitude;

  // 使用者目前位置
  marker.setPosition(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
  map.setCenter(marker.getPosition()!);
};
const errorCallback = (error: any) => {
  console.log(error);
  if (error.code === 1) {
    // 使用者未開啟定位
    isShowGeoError.value = true;
  }
};

const fetchAndFormatData = async (
  url: string,
  formatter: (item: any, formatFields: any, serviceInfos: any[]) => Spot,
  formatFields: any,
  serviceInfos: any,
  dataPath: string
) => {
  try {
    const response = await axios.get(url);
    return formatSpotData(response.data, formatter, formatFields, serviceInfos, dataPath);
  } catch (error) {
    console.error(`Failed to fetch data from ${url}:`, error);
    return [];
  }
};

const formatSpotData = (
  data: any,
  formatter: (item: any, formatFields: any, serviceInfos: any[]) => Spot,
  formatFields: any,
  serviceInfos: any,
  dataPath: string
): Spot[] => {
  // 動態解析 dataPath，如果沒有提供 dataPath，默認使用 response
  const targetData = dataPath ? getNestedValue(data, dataPath) : data;
  return targetData.map((item: any) => formatter(item, formatFields, serviceInfos));
};

const updateMarkers = async () => {
  if (!selectedSearchData.value.id) {
    clearMarkers();
    return;
  }

  const bounds = map.getBounds();
  if (!bounds) return;

  filteredSpotList.value = searchSpotList.value
    .map((spot) => ({
      ...spot,
      position: new google.maps.LatLng(spot.lat, spot.lng)
    }))
    .filter((spot) => bounds.contains(spot.position))
    .map((spot) => ({
      ...spot,
      distance: parseFloat(
        (
          google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(currentLocation.value.lat, currentLocation.value.lng),
            new google.maps.LatLng(spot.lat, spot.lng)
          ) / 1000
        ).toFixed(1)
      )
    }));

  console.log('filteredSpotList:', filteredSpotList.value);

  // Clear existing markers
  clearMarkers();

  let currentFocusedMarker: any = null;

  filteredSpotList.value.forEach((spot) => {
    const greenDotIcon = {
      url: greenDotIconUrl, // 預設綠色小圓點圖標的路徑
      scaledSize: new google.maps.Size(20, 20), // 設置圖標的大小
      anchor: new google.maps.Point(10, 20) // 設置圖標的錨點，使其中心對齊底部
    };

    const marker = new google.maps.Marker({
      position: { lat: Number(spot.lat), lng: Number(spot.lng) },
      map,
      icon: greenDotIcon
    });

    marker.addListener('click', () => {
      if (currentFocusedMarker && currentFocusedMarker !== marker) {
        // 恢復之前聚焦的標記為預設圖標
        currentFocusedMarker.setIcon(greenDotIcon);
        selectedSpot.value = null;
      }

      const focusedIcon = {
        url: defaultFocusIconUrl, // 點擊後聚焦圖標的路徑
        scaledSize: new google.maps.Size(48, 69), // 設置圖標的大小
        anchor: new google.maps.Point(24, 69) // 設置圖標的錨點，使其中心對齊底部
      };

      // 設置當前標記為聚焦圖標
      marker.setIcon(focusedIcon);
      currentFocusedMarker = marker;

      // 獲取所選擇的 spot 的所有屬性
      selectedSpot.value = spot;
      console.log('Selected spot:', selectedSpot);
    });

    markers.push(marker);
  });

  // Add a marker clusterer to manage the markers.
  markerCluster = new MarkerClusterer({
    markers,
    map,
    algorithm: new SuperClusterAlgorithm({ radius: 300 }), // 设置gridSize
    renderer: {
      render({ count, position }, stats) {
        // change color if this cluster has more markers than the mean cluster
        const circleRadius =
          count > Math.max(10, stats.clusters.markers.mean)
            ? count > Math.max(100, stats.clusters.markers.mean)
              ? '100'
              : '90'
            : '80';
        // create svg literal with fill color
        const svg =
          window.btoa(`<svg fill="#2eb6c7" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="50" height="50">
          <circle fill="#2eb6c7" cx="120" cy="120" opacity=".6" r="${circleRadius}" />
          <circle fill="#fff" cx="120" cy="120" r="70" />
          <text x="50%" y="50%" style="fill:#2eb6c7" text-anchor="middle" font-size="50" dominant-baseline="middle" font-family="roboto,arial,sans-serif">${count}</text>
          </svg>`);

        // create marker using svg icon
        return new google.maps.Marker({
          position,
          icon: {
            url: `data:image/svg+xml;base64,${svg}`,
            scaledSize: new google.maps.Size(75, 75)
          },
          // adjust zIndex to be above other markers
          zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count
        });
      }
    }
  });
};

const clearMarkers = () => {
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
  if (markerCluster) {
    markerCluster.clearMarkers();
  }
  selectedSpot.value = null;
};

// Watch for changes in searchSpotList
watch(searchSpotList, updateMarkers);

const tryRoute = () => {
  if (!directionsService || !directionsRenderer) return;
  if (!originPlace.value || !destinationPlace.value) return;

  // 畫出使用者位置、起點與終點 marker
  clearMarkers();
  const startMarker = new google.maps.Marker({
    position: { lat: Number(originPlace.value.lat), lng: Number(originPlace.value.lng) },
    map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: '#34A853',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#fff'
    }
  });
  const endMarker = new google.maps.Marker({
    position: { lat: Number(destinationPlace.value.lat), lng: Number(destinationPlace.value.lng) },
    map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: '#EA4335',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#fff'
    }
  });
  markers.push(startMarker, endMarker);

  directionsService.route(
    {
      origin: { lat: Number(originPlace.value.lat), lng: Number(originPlace.value.lng) },
      destination: {
        lat: Number(destinationPlace.value.lat),
        lng: Number(destinationPlace.value.lng)
      },
      travelMode: google.maps.TravelMode.DRIVING
    },
    (res, status) => {
      if (status === 'OK' && res) {
        directionsRenderer!.setDirections(res);
        // 加入歷史紀錄
        tripStore.addHistory({
          origin: originPlace.value as {
            name: string;
            lat?: number;
            lng?: number;
            address?: string;
          },
          destination: destinationPlace.value as {
            name: string;
            lat?: number;
            lng?: number;
            address?: string;
          }
        });
      }
    }
  );
};

const applyShortcut = (s: ShortcutTrip) => {
  if (!s?.destination?.lat || !s?.destination?.lng || !s?.destination?.name) return;
  destinationPlace.value = {
    name: s.destination.name as string,
    lat: s.destination.lat,
    lng: s.destination.lng,
    address: s.destination.address
  };
  destinationInput.value = s.destination.name as string;
  tryRoute();
};

const applyHistory = (h: HistoryTrip) => {
  if (!h.origin || !h.destination) return;
  originPlace.value = h.origin;
  destinationPlace.value = h.destination;
  originInput.value = h.origin?.name || '';
  destinationInput.value = h.destination?.name || '';
  tryRoute();
};

const applyFavorite = (f: any) => {
  if (!f.origin || !f.destination) return;
  originPlace.value = f.origin;
  destinationPlace.value = f.destination;
  originInput.value = f.origin?.name || '';
  destinationInput.value = f.destination?.name || '';
  tryRoute();
};

const openEditFavorite = (f: SavedTrip) => {
  editingFavorite.value = f;
  newFavoriteName.value = f.name;
  originInput.value = f.origin?.name || '';
  destinationInput.value = f.destination?.name || '';
  pinToHome.value = !!f.pinToHome;
  showFavoriteDialog.value = true;
};
</script>

<template>
  <div class="pb-8 h-screen">
    <div
      :class="{ hidden: isExpandList || isExpandDetail, visible: !isExpandList && !isExpandDetail }"
    >
      <!-- 服務地點搜尋（保留原功能） -->
      <!-- <div class="flex items-center">
        <FindPlace
          @onSearchChange="(value) => handleSearchChange(value)"
          @update:isExpand="handleExpandChange"
        />
      </div> -->
      <!-- 地圖 -->
      <div class="relative flex-1" :class="{ hidden: isExpand, visible: !isExpand }">
        <div class="google-map" id="map"></div>
        <div
          v-if="isMapReady"
          class="gps"
          @click="getPositionClick"
          :style="{ bottom: sheetHeight + 10 + 'px', top: 'auto' }"
        >
          <img src="@/assets/images/gps.png" width="20" alt="" />
        </div>

        <!-- 底部面板：上車囉/今天去哪玩？、快捷、起迄輸入、歷史與常用 -->
        <div
          ref="sheetRef"
          class="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-[0_-4px_10px_rgba(0,0,0,0.04)]"
          :style="{ height: sheetHeight + 'px' }"
        >
          <!-- drag handle -->
          <div
            class="w-full flex items-center justify-center pt-2 cursor-grab select-none"
            @mousedown="onHandleMouseDown"
            @touchstart="onHandleTouchStart"
          >
            <div class="w-8 h-1.5 bg-grey-300 rounded-full"></div>
          </div>

          <div class="px-4 pb-2 flex items-center justify-between">
            <p class="text-grey-700 font-extrabold text-2xl">上車囉～</p>
          </div>

          <!-- 快捷按鈕（從 store 取） -->
          <div class="px-4 mt-1 flex gap-2">
            <button
              v-for="s in tripStore.shortcuts"
              :key="s.id"
              class="px-3 py-1 bg-white text-primary-500 font-bold rounded-full border-2 border-primary-300 shadow-sm"
              @click="() => applyShortcut(s)"
            >
              {{ s.label }}
            </button>
          </div>

          <!-- 起點 / 目的地 輸入 -->
          <div class="px-4 mt-3">
            <div
              class="sheet-card relative rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] p-2"
            >
              <img
                src="@/assets/images/route-icon.svg"
                class="absolute left-4 top-1/2 -translate-y-1/2 w-7 h-auto"
                alt=""
              />
              <div class="pl-12">
                <div class="rounded-lg p-2 bg-white">
                  <div class="text-sm text-grey-700">起始站</div>
                  <input
                    ref="originInputEl"
                    v-model="originInput"
                    placeholder="點按以選擇起始站"
                    class="w-full bg-white"
                  />
                </div>
                <div class="mx-2 h-0.5 bg-grey-200"></div>
                <div class="rounded-lg p-2 bg-white">
                  <div class="text-sm text-grey-700">終點站</div>
                  <input
                    ref="destinationInputEl"
                    v-model="destinationInput"
                    placeholder="點按以選擇終點站"
                    class="w-full bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 歷史 / 常用 切換 + 列表 -->
          <div class="px-4 mt-4">
            <div class="flex gap-2 mb-3">
              <button
                class="px-3 py-1 rounded-full border"
                :class="{
                  'bg-primary-500 text-white border-primary-500': activeList === 'history',
                  'text-grey-700 border-grey-300': activeList !== 'history'
                }"
                @click="activeList = 'history'"
              >
                歷史
              </button>
              <button
                class="px-3 py-1 rounded-full border"
                :class="{
                  'bg-primary-500 text-white border-primary-500': activeList === 'favorite',
                  'text-grey-700 border-grey-300': activeList !== 'favorite'
                }"
                @click="activeList = 'favorite'"
              >
                常用
              </button>
              <button
                class="ml-auto text-primary-500 underline"
                v-if="activeList === 'favorite'"
                @click="() => (showFavoriteDialog = true)"
              >
                新增常用行程
              </button>
            </div>

            <ul class="space-y-3 overflow-y-auto" :style="{ maxHeight: sheetHeight - 240 + 'px' }">
              <template v-if="activeList === 'history'">
                <li
                  v-for="h in tripStore.histories"
                  :key="h.id"
                  class="flex justify-between items-center p-3 rounded-lg border border-grey-200 cursor-pointer"
                  @click="() => applyHistory(h)"
                >
                  <div class="text-grey-700 text-sm truncate">
                    <span class="font-semibold">{{ h.origin?.name }}</span>
                    <span class="mx-1">→</span>
                    <span class="font-semibold">{{ h.destination?.name }}</span>
                  </div>
                </li>
                <li v-if="!tripStore.histories.length" class="text-grey-500 text-sm">
                  目前沒有歷史紀錄
                </li>
              </template>
              <template v-else>
                <li
                  v-for="f in tripStore.favorites"
                  :key="f.id"
                  class="flex justify-between items-center p-3 rounded-lg border border-grey-200"
                  @click="() => applyFavorite(f)"
                >
                  <div class="text-grey-700 text-sm truncate">
                    <span class="font-semibold">{{ f.name }}</span>
                    <span class="mx-2 text-grey-400">|</span>
                    <span>{{ f.origin?.name }}</span>
                    <span class="mx-1">→</span>
                    <span>{{ f.destination?.name }}</span>
                  </div>
                  <button class="ml-3 p-1" @click.stop="openEditFavorite(f)">
                    <img src="@/assets/images/other-icon.svg" class="w-5 h-5" />
                  </button>
                </li>
                <li v-if="!tripStore.favorites.length" class="text-grey-500 text-sm">
                  尚無常用行程
                </li>
              </template>
            </ul>
          </div>
        </div>
      </div>
      <!-- 選取的點 -->
      <div
        v-if="selectedSearchData.id && !isExpand && selectedSpot"
        class="floating-box bottom-24 left-[50%] translate-x-[-50%] w-[90%]"
        @click="
          isExpandDetail = true;
          isFrom = 'spot';
        "
      >
        <div>
          <p class="font-bold mb-2">{{ selectedSpot.name }}</p>
          <div class="flex mb-2">
            <img src="@/assets/images/icon-geo.svg" alt="" />
            <span class="underline">{{ selectedSpot.address }}</span>
          </div>
          <!-- custom template -->
          <div class="flex text-grey-500">
            <span>{{ selectedSpot.distance }}公里</span>
          </div>
        </div>
        <img src="@/assets/images/down-icon.svg" class="-rotate-90" alt="" />
      </div>
      <!-- 底部搜尋結果 -->
      <div v-if="selectedSearchData.id && !isExpand" class="floating-box bottom-0 w-full">
        <div class="flex items-center">
          <span class="font-bold mr-2">{{ selectedSearchData.name }}</span>
          <div class="text-primary-500 border border-primary-500 rounded-full px-2">
            {{ filteredSpotList.length }}筆結果
          </div>
        </div>
        <a class="text-primary-500" @click="isExpandList = true">展開列表</a>
      </div>
    </div>
    <!-- 搜尋結果列表 -->
    <SpotList
      v-if="isExpandList"
      :selectedSearchData="selectedSearchData"
      :filteredSpotList="filteredSpotList"
      @update:isExpandList="(value: boolean) => (isExpandList = value)"
      @update:selectedSpot="
        (value: Spot) => {
          selectedSpot = value;
          isExpandDetail = true;
          isFrom = 'list';
        }
      "
    />
    <!-- 搜尋結果明細 -->
    <SpotDetail
      v-if="selectedSpot && isExpandDetail && isFrom"
      :selectedSearchData="selectedSearchData"
      :selectedSpot="selectedSpot"
      @update:isExpandDetail="
        (value) => {
          isExpandDetail = value;
          selectedSpot = null;
          if (isFrom === 'list') {
            isExpandList = true;
          }
          isFrom = '';
        }
      "
    />
  </div>

  <!-- geo modal -->
  <MessageModal :is-show="isShowGeoError">
    <template #header>
      <p>請啟用定位服務</p>
    </template>
    <template #body>
      <p class="text-grey-700">打開定位服務來允許“城市通”確認您的位置</p>
    </template>
    <template #footer>
      <button class="text-primary-500 px-7 py-2 w-full" @click="isShowGeoError = false">
        確認
      </button>
    </template>
  </MessageModal>

  <!-- 新增常用行程 Dialog -->
  <BaseDialog
    v-model="showFavoriteDialog"
    is-slot
    content=""
    positive-text="儲存"
    negative-text="取消"
    @onPositiveClick="saveFavorite"
  >
    <template #content>
      <div class="space-y-3">
        <div>
          <label class="text-sm text-grey-600">行程名稱</label>
          <BaseInput v-model="newFavoriteName" placeholder="輸入名稱" class="w-full" />
        </div>
        <div>
          <label class="text-sm text-grey-600">起點</label>
          <BaseInput v-model="originInput" placeholder="輸入/選擇 起始地點" class="w-full" />
        </div>
        <div>
          <label class="text-sm text-grey-600">目的地</label>
          <BaseInput v-model="destinationInput" placeholder="輸入/選擇 目的地" class="w-full" />
        </div>
        <div class="flex items-center gap-2">
          <input id="pinHome" type="checkbox" v-model="pinToHome" />
          <label for="pinHome" class="text-sm">釘選到主頁</label>
        </div>
      </div>
    </template>
    <template #default></template>
    <template #footer></template>
  </BaseDialog>
</template>

<style lang="postcss" scoped>
.google-map {
  width: 100%;
  height: 400px;
}

.marker {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
}

.gps {
  position: absolute;
  right: 10px;
  /* default top disabled; we control by inline style with bottom above sheet */
  background-color: rgb(255, 255, 255);
  width: 40px;
  height: 40px;
  user-select: none;
  box-shadow: rgba(0, 0, 0, 0.3) 0px 1px 4px -1px;
  border-radius: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.floating-box {
  @apply absolute flex items-center justify-between bg-white px-4 py-6 rounded-xl;
  box-shadow: rgba(0, 0, 0, 0.04) 0px -4px 10px;
}

.cursor-grab {
  cursor: grab;
}

.sheet-card {
  position: relative;
}
</style>
