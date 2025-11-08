<script setup lang="ts">
import MessageModal from '@/components/molecules/MessageModal.vue';
import BaseDialog from '@/components/atoms/BaseDialog.vue';
import { useRouter } from 'vue-router';
import { useGoogleMapsStore } from '@/stores/googleMaps';
import { useTripStore } from '@/stores/trip';
import type { HistoryStation, SavedTrip } from '@/stores/trip';
import axios from 'axios';
import { onMounted, onUnmounted, ref, watch, nextTick, computed } from 'vue';
import { disableBodyScroll, enableBodyScroll } from 'body-scroll-lock';
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import { youbikeFilter } from '@/utils/youbike-filter';
import greenDotIconUrl from '/public/images/map/youbike/mappin-green.svg';
import yellowDotIconUrl from '/public/images/map/youbike/mappin-yellow.svg';
import redDotIconUrl from '/public/images/map/youbike/mappin-red.svg';
import greenYouBikeIconUrl from '/public/images/map/youbike/icon_mappin-ubike-green-pressed.svg';
import yellowYouBikeIconUrl from '/public/images/map/youbike/icon_mappin-ubike-yellow-pressed.svg';
import redYouBikeIconUrl from '/public/images/map/youbike/icon_mappin-ubike-red-pressed.svg';

import iconOriginUrl from '@/assets/images/icon-origin.svg';
import iconDestUrl from '@/assets/images/icon-dest.svg';

export interface Spot {
  /** 站點編號 */
  sno: string;
  /** 站點名稱（中文） */
  sna: string;
  /** 行政區（中文） */
  sarea: string;
  /** 地址 */
  ar: string;
  /** 行政區（英文） */
  sareaen?: string;
  /** 站點名稱（英文） */
  snaen?: string;
  /** 地址（英文） */
  aren?: string;
  /** 啟用狀態 */
  act?: string;
  /** 更新時間 */
  mday?: string;
  srcUpdateTime?: string;
  updateTime?: string;
  infoTime?: string;
  infoDate?: string;
  /** 總車位數 */
  Quantity?: number;
  /** 可借車輛數 */
  available_rent_bikes?: number;
  /** 可還車位數 */
  available_return_bikes?: number;
  /** 總停車位數 */
  parking_spaces?: number;
  /** 可用停車位數 */
  available_spaces?: number;
  /** 可用停車位詳細資訊 */
  available_spaces_detail?: {
    yb2?: number;
    eyb?: number;
  };
  /** 空車位數 */
  empty_spaces?: number;
  /** 禁用車位數 */
  forbidden_spaces?: number;
  /** 可用車位等級 */
  available_spaces_level?: number;
  /** 站點編號（同 sno） */
  station_no?: string;
  /** 緯度 */
  latitude?: number;
  lat?: number | string;
  /** 經度 */
  longitude?: number;
  lng?: number | string;
  /** 狀態 */
  status?: number;
  /** 距離（計算後加入） */
  distance?: number;
  /** 詳細資訊 */
  service_infos?: {
    title: string;
    value: { title: string; value: string }[] | string;
  }[];

  /** 其餘詳細資訊 */
  [key: string]: any;
}

const router = useRouter();
const googleMapsStore = useGoogleMapsStore();
const tripStore = useTripStore();

/** 搜尋結果 */
const searchSpotList = ref<Spot[]>([]);
/** 視窗下搜尋結果 */
const filteredSpotList = ref<Spot[]>([]);
const selectedSpot = ref<Spot | null>(null);

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
const originPlace = ref<{
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
} | null>(null);
const destinationPlace = ref<{
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
} | null>(null);
const originInputEl = ref<HTMLInputElement | null>(null);
const destinationInputEl = ref<HTMLInputElement | null>(null);

// 選中的輸入框狀態（true = 終點, false = 起點）
const selectedDest = ref(false);

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

const deleteFavorite = () => {
  if (editingFavorite.value) {
    tripStore.deleteFavorite(editingFavorite.value.id);
  }
  showFavoriteDialog.value = false;
  newFavoriteName.value = '';
  pinToHome.value = false;
  editingFavorite.value = null;
};

// 顯示在 Favorite 對話框中的起點/終點欄位：
// 若使用者在編輯過程已重新選取，優先顯示新選取；否則顯示原資料
const favoriteOriginName = computed(
  () => originPlace.value?.name || editingFavorite.value?.origin?.name || ''
);
const favoriteDestinationName = computed(
  () => destinationPlace.value?.name || editingFavorite.value?.destination?.name || ''
);

/**
 * 目前位置
 */
const currentLocation = ref<{ lat: number; lng: number; results: any[] }>({
  // 預設經緯度在台大體育館
  lat: 25.0219526,
  lng: 121.5354825,
  results: []
});

/**
 * 是否顯示未開啟取用位置權限通知
 */
let isShowGeoError = ref(false);

// 初始化載入 YouBike 資料
const loadYouBikeData = async () => {
  try {
    // const response = await axios.get('/mock/youbike_mock_data.json');
    const response = await axios.get(
      'https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json',
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    // 將資料轉換為 Spot 格式，確保 lat/lng 統一，並預處理站名 sna（保留第一個 "_" 之後的字串）
    searchSpotList.value = youbikeFilter(response.data as any[]);
  } catch (error) {
    console.error('Failed to load YouBike data:', error);
  }
};

onMounted(() => {
  initMap(currentLocation.value.lat, currentLocation.value.lng);
  setSheetSizes();
  loadYouBikeData();
});

const setMapHeight = () => {
  const mapElement = document.getElementById('map');
  if (mapElement) {
    mapElement.style.height = `${window.innerHeight - sheetHeight.value}px`;
  }
};

// 判斷起點和終點是否都已設定（需要先定義，以便在 sheetMin 中使用）
const isRouteReady = computed(() => {
  return !!(originPlace.value && destinationPlace.value);
});

// Bottom Sheet: sizes & drag behavior
const sheetRef = ref<HTMLElement | null>(null);
const sheetHeight = ref(0);
// 當路線準備好時，使用較小的最小高度（約140px，足夠顯示兩個按鈕）
const sheetMin = computed(() => (isRouteReady.value ? 140 : 260));
const sheetMid = ref(0); // 視窗 50%
const sheetMax = ref(0); // 視窗 85%
const isDraggingSheet = ref(false);
let dragStartY = 0;
let dragStartHeight = 0;

const setSheetSizes = () => {
  sheetMid.value = Math.round(window.innerHeight * 0.5);
  sheetMax.value = Math.round(window.innerHeight * 0.85);
  // 初始化高度：至少為最小高度或中段（取較大者）
  if (!sheetHeight.value) sheetHeight.value = sheetMin.value;
  // 若當前高度小於最小高度，立即提到最小高度
  if (sheetHeight.value < sheetMin.value) sheetHeight.value = sheetMin.value;
  // 更新地圖高度以適應底部面板高度
  setMapHeight();
};

const onSheetDragStart = (clientY: number) => {
  isDraggingSheet.value = true;
  dragStartY = clientY;
  dragStartHeight = sheetHeight.value;
  document.body.style.userSelect = 'none';
};
const onSheetDragMove = (clientY: number) => {
  if (!isDraggingSheet.value) return;
  // 當路線準備好時，不允許拖曳
  if (isRouteReady.value) return;
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

const onHandleMouseDown = (e: MouseEvent) => {
  // 當路線準備好時，不允許拖曳
  if (isRouteReady.value) return;
  onSheetDragStart(e.clientY);
};
const onHandleMouseMove = (e: MouseEvent) => onSheetDragMove(e.clientY);
const onHandleTouchStart = (e: TouchEvent) => {
  // 當路線準備好時，不允許拖曳
  if (isRouteReady.value) return;
  onSheetDragStart(e.touches[0].clientY);
};
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
  // 更新地圖高度以適應底部面板高度變化
  setMapHeight();
  if (h > sheetMin.value + 10) {
    disableBodyScroll(target, { reserveScrollBarGap: true });
  } else {
    enableBodyScroll(target);
  }
});

// 監聽 isRouteReady 變化，自動調整 sheetHeight 到最小高度
watch(isRouteReady, (ready) => {
  if (ready) {
    // 當路線準備好時，自動調整到最小高度
    sheetHeight.value = sheetMin.value;
  } else {
    // 當路線未準備好時，恢復到原本的最小高度
    setSheetSizes();
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

    map = new Map(document.getElementById('map') as HTMLElement, {
      // 設定地圖的中心點經緯度位置
      center: { lat, lng },
      // 設定地圖縮放比例 0-20
      zoom: 14,
      // 限制使用者能縮放地圖的最大比例
      maxZoom: 20,
      // 限制使用者能縮放地圖的最小比例
      minZoom: 12,
      // 設定是否呈現右下角街景小人
      streetViewControl: false,
      // 設定是否讓使用者可以切換地圖樣式：一般、衛星圖等
      mapTypeControl: false,
      fullscreenControl: false,
      disableDefaultUI: true,
      zoomControl: false,
      // 替換成您的 MAP ID
      mapId: '',
      // 顯示 POI，但禁止點擊開啟資訊
      clickableIcons: false
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
      if (isRouteReady.value) return; // 路線顯示時，不更新站點標記
      updateMarkers();
    });

    // // 在地圖的zoom_changed事件上使用該函數
    map.addListener('zoom_changed', function () {
      if (isRouteReady.value) return; // 路線顯示時，不更新站點標記
      updateMarkers();
    });

    isMapReady.value = true;
    setMapHeight();
    window.addEventListener('resize', setMapHeight);

    // Directions service/renderer
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#2eb6c7',
        strokeWeight: 8,
        strokeOpacity: 1,
        zIndex: 1
      }
    });
    directionsRenderer.setMap(map);

    // Setup address search for origin/destination (等待 DOM 準備好)
    nextTick(() => {
      setupAddressSearch();
    });

    // 地圖準備好後，如果有資料則更新標記
    if (searchSpotList.value.length > 0) {
      updateMarkers();
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

const updateMarkers = async () => {
  // 如果沒有搜尋資料且沒有站點資料，清除標記
  if (searchSpotList.value.length === 0) {
    clearMarkers();
    return;
  }

  const bounds = map.getBounds();
  if (!bounds) return;

  filteredSpotList.value = searchSpotList.value
    .map((spot) => {
      // 優先使用 latitude/longitude，否則使用 lat/lng（轉為數字）
      const lat =
        spot.latitude ?? (typeof spot.lat === 'string' ? parseFloat(spot.lat) : spot.lat ?? 0);
      const lng =
        spot.longitude ?? (typeof spot.lng === 'string' ? parseFloat(spot.lng) : spot.lng ?? 0);
      return {
        ...spot,
        lat,
        lng,
        position: new google.maps.LatLng(lat, lng)
      };
    })
    .filter((spot) => spot.lat && spot.lng && bounds.contains(spot.position))
    .map((spot) => ({
      ...spot,
      distance: parseFloat(
        (
          google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(currentLocation.value.lat, currentLocation.value.lng),
            new google.maps.LatLng(spot.lat!, spot.lng!)
          ) / 1000
        ).toFixed(1)
      )
    }));

  // console.log('filteredSpotList:', filteredSpotList.value);

  // Clear existing markers
  clearMarkers();

  let currentFocusedMarker: any = null;

  // 根據可用車輛數選擇圖標
  const getYouBikeIconUrl = (
    availableRentBikes: number | undefined,
    availableReturnBikes: number | undefined,
    focused: boolean
  ): string => {
    if (availableRentBikes !== 0 && availableReturnBikes !== 0) {
      return focused ? greenYouBikeIconUrl : greenDotIconUrl;
    } else if (availableRentBikes === 0) {
      return focused ? yellowYouBikeIconUrl : yellowDotIconUrl;
    } else {
      return focused ? redYouBikeIconUrl : redDotIconUrl;
    }
  };

  filteredSpotList.value.forEach((spot) => {
    const iconUrl = getYouBikeIconUrl(
      spot.available_rent_bikes,
      spot.available_return_bikes,
      false
    );
    const defaultIcon = {
      url: iconUrl,
      scaledSize: new google.maps.Size(20, 20), // 設置圖標的大小
      anchor: new google.maps.Point(10, 20) // 設置圖標的錨點，使其中心對齊底部
    };

    const marker = new google.maps.Marker({
      position: { lat: Number(spot.lat), lng: Number(spot.lng) },
      map,
      icon: defaultIcon
    });

    marker.addListener('click', () => {
      if (currentFocusedMarker && currentFocusedMarker !== marker) {
        // 恢復之前聚焦的標記為對應顏色的圖標
        const prevSpot = currentFocusedMarker.spotData;
        const prevIconUrl = prevSpot
          ? getYouBikeIconUrl(prevSpot.available_rent_bikes, prevSpot.available_return_bikes, false)
          : greenDotIconUrl;
        currentFocusedMarker.setIcon({
          url: prevIconUrl,
          scaledSize: new google.maps.Size(20, 20),
          anchor: new google.maps.Point(10, 20)
        });
        selectedSpot.value = null;
      }

      const focusedIcon = {
        url: getYouBikeIconUrl(spot.available_rent_bikes, spot.available_return_bikes, true), // 點擊後聚焦圖標的路徑
        scaledSize: new google.maps.Size(48, 69), // 設置圖標的大小
        anchor: new google.maps.Point(24, 69) // 設置圖標的錨點，使其中心對齊底部
      };

      // 設置當前標記為聚焦圖標
      marker.setIcon(focusedIcon);
      // 保存 spot 資料到 marker，以便恢復時使用
      (marker as any).spotData = spot;
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
    algorithm: new SuperClusterAlgorithm({ radius: 300 }),
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

// 選擇當前 spot 作為起點或終點
const selectCurrentSpot = () => {
  if (!selectedSpot.value) return;

  const spot = selectedSpot.value;
  const placeData = {
    id: String(spot.sno),
    name: spot.sna,
    lat: typeof spot.lat === 'number' ? spot.lat : spot.latitude ?? 0,
    lng: typeof spot.lng === 'number' ? spot.lng : spot.longitude ?? 0,
    address: spot.ar
  };
  if (originPlace.value === destinationPlace.value && originPlace.value !== null) return;
  if (selectedDest.value) {
    // 設置為終點
    destinationPlace.value = placeData;
    destinationInput.value = placeData.name;
  } else {
    // 設置為起點
    originPlace.value = placeData;
    originInput.value = placeData.name;
  }

  selectedDest.value = !selectedDest.value;

  // 將地圖中心跳轉到選擇的地點
  if (map && placeData.lat && placeData.lng) {
    map.setCenter({ lat: placeData.lat, lng: placeData.lng });
    map.setZoom(15);
  }

  // 如果起點和終點都已設定，嘗試規劃路線
  if (originPlace.value && destinationPlace.value) {
    tryRoute();
  }
};

const tryRoute = () => {
  if (!directionsService || !directionsRenderer) return;
  if (!originPlace.value || !destinationPlace.value) return;

  // 畫出使用者位置、起點與終點 marker
  clearMarkers();
  const startMarker = new google.maps.Marker({
    position: { lat: Number(originPlace.value.lat), lng: Number(originPlace.value.lng) },
    map,
    icon: {
      url: iconOriginUrl,
      scaledSize: new google.maps.Size(48, 69), // 設置圖標的大小
      anchor: new google.maps.Point(24, 69) // 設置圖標的錨點，使其中心對齊底部
    }
  });
  const endMarker = new google.maps.Marker({
    position: { lat: Number(destinationPlace.value.lat), lng: Number(destinationPlace.value.lng) },
    map,
    icon: {
      url: iconDestUrl,
      scaledSize: new google.maps.Size(48, 69), // 設置圖標的大小
      anchor: new google.maps.Point(24, 69) // 設置圖標的錨點，使其中心對齊底部
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
      travelMode: google.maps.TravelMode.BICYCLING
    },
    (res, status) => {
      if (status === 'OK' && res) {
        console.log('res:', res);
        directionsRenderer!.setDirections(res);
        // 加入歷史站點（Ordered Set）
        if (originPlace.value) {
          tripStore.addHistory({ place: originPlace.value });
        }
        if (destinationPlace.value) {
          tripStore.addHistory({ place: destinationPlace.value });
        }
      }
    }
  );
};

// 地址搜尋函數（使用 Google Geocoder）
const searchAddress = (address: string) => {
  if (!address || address.trim() === '') return;

  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address: address }, (results, status) => {
    if (status === 'OK' && results && results[0]) {
      const location = results[0].geometry.location;

      // 將地圖中心跳轉到選擇的地點
      map.setCenter({ lat: location.lat(), lng: location.lng() });
      map.setZoom(15);

      // 如果起點和終點都已設定，嘗試規劃路線
      if (originPlace.value && destinationPlace.value) {
        tryRoute();
      }
    } else {
      console.warn('無法找到地址:', address, status);
    }
  });
};

// 設置地址搜尋事件監聽
const setupAddressSearch = () => {
  if (originInputEl.value) {
    originInputEl.value.addEventListener('blur', () => {
      if (originInput.value && originInput.value.trim() !== '') {
        searchAddress(originInput.value);
        originInputEl.value?.blur();
        originInput.value = '';
      }
    });
    originInputEl.value.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (originInput.value && originInput.value.trim() !== '') {
          searchAddress(originInput.value);
          originInputEl.value?.blur();
          originInput.value = '';
        }
      }
    });
  }

  if (destinationInputEl.value) {
    destinationInputEl.value.addEventListener('blur', () => {
      if (destinationInput.value && destinationInput.value.trim() !== '') {
        searchAddress(destinationInput.value);
        destinationInputEl.value?.blur();
        destinationInput.value = '';
      }
    });
    destinationInputEl.value.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (destinationInput.value && destinationInput.value.trim() !== '') {
          searchAddress(destinationInput.value);
          destinationInputEl.value?.blur();
          destinationInput.value = '';
        }
      }
    });
  }
};

const applyShortcut = (s: SavedTrip) => {
  if (!s.origin || !s.destination) return;
  originPlace.value = s.origin;
  originInput.value = s.origin.name;
  destinationPlace.value = s.destination;
  destinationInput.value = s.destination.name;
  selectedDest.value = true;
  tryRoute();
};

// 歷史站點：點擊後根據 selectedDest 填入起點或終點
const applyHistoryStation = (h: HistoryStation) => {
  if (!h.place) return;
  if (selectedDest.value) {
    if (originPlace.value === h.place) return;
    // 設置為終點
    destinationPlace.value = h.place as any;
    destinationInput.value = h.place.name || '';
  } else {
    if (destinationPlace.value === h.place) return;
    // 設置為起點
    originPlace.value = h.place as any;
    originInput.value = h.place.name || '';
  }
  selectedDest.value = !selectedDest.value;

  // 如果起點和終點都已設定，嘗試規劃路線
  if (originPlace.value && destinationPlace.value) {
    tryRoute();
  }
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
  pinToHome.value = !!f.pinToHome;
  showFavoriteDialog.value = true;
};

// ---- Favorites swipe-to-delete state & handlers ----
const favoriteSwipeX = ref<Record<string, number>>({});
const favoriteTransition = ref<Record<string, boolean>>({});
type DragMeta = {
  startX: number;
  startY: number;
  baseX: number;
  dragging: boolean;
  lockedAxis: null | 'x' | 'y';
  moved: boolean;
  startTime: number;
};
const favoriteDragState = ref<Record<string, DragMeta>>({});
const MAX_LEFT = -80; // 最大左滑
const DELETE_THRESHOLD = -60; // 超過即觸發動作

const ensureMeta = (id: string) => {
  if (!favoriteDragState.value[id]) {
    favoriteDragState.value[id] = {
      startX: 0,
      startY: 0,
      baseX: favoriteSwipeX.value[id] || 0,
      dragging: false,
      lockedAxis: null,
      moved: false,
      startTime: 0
    };
  }
  return favoriteDragState.value[id];
};

// 依站點 id 取得 YouBike 站點資料（從 mock 載入的 searchSpotList）
const spotById = (id: string) =>
  searchSpotList.value.find((s: any) => String(s.sno ?? s.id) === String(id));

// 計算目前位置到指定座標的距離（公里）
const distanceKm = (lat1: number, lng1: number, lat2?: number, lng2?: number) => {
  if (lat2 == null || lng2 == null) return null;
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const onFavPointerDown = (e: PointerEvent, id: string) => {
  const meta = ensureMeta(id);
  meta.startX = e.clientX;
  meta.startY = e.clientY;
  meta.baseX = favoriteSwipeX.value[id] || 0;
  meta.dragging = true;
  meta.lockedAxis = null;
  meta.moved = false;
  meta.startTime = Date.now();
  favoriteTransition.value[id] = false;
};

const onFavPointerMove = (e: PointerEvent, id: string) => {
  const meta = favoriteDragState.value[id];
  if (!meta || !meta.dragging) return;

  const dx = e.clientX - meta.startX;
  const dy = e.clientY - meta.startY;

  if (!meta.lockedAxis) {
    if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
      meta.lockedAxis = 'x';
    } else if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) {
      meta.lockedAxis = 'y';
    }
  }

  if (meta.lockedAxis === 'y') {
    return; // 讓列表可垂直滾動
  }

  // 水平滑動
  if (meta.lockedAxis === 'x') {
    // 僅在確定為水平拖曳時阻止預設避免點擊被吃掉
    e.preventDefault();
  }
  // 設定為移動需超過微小閾值，避免微動被當滑動
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    meta.moved = true;
  }
  let next = meta.baseX + dx;
  if (next > 0) next = 0; // 不允許向右滑
  if (next < MAX_LEFT) next = MAX_LEFT;
  favoriteSwipeX.value[id] = next;
};

const snapWithTransition = (id: string, x: number) => {
  favoriteTransition.value[id] = true;
  favoriteSwipeX.value[id] = x;
  // 移除 transition 標記以便下次拖曳
  window.setTimeout(() => {
    favoriteTransition.value[id] = false;
  }, 200);
};

const onFavPointerUp = (_e: PointerEvent, id: string) => {
  const meta = favoriteDragState.value[id];
  if (!meta) return;
  meta.dragging = false;

  const x = favoriteSwipeX.value[id] || 0;
  const duration = Date.now() - (meta.startTime || Date.now());

  // 如果鎖定了垂直軸（y），或沒有移動，直接回位
  if (meta.lockedAxis === 'y' || !meta.moved) {
    // 視為點擊：若幾乎沒有位移且時間短，觸發套用
    if (Math.abs(x) < 5 && duration < 250) {
      const f = tripStore.favorites.find((fav) => fav.id === id);
      if (f) applyFavorite(f);
    }
    snapWithTransition(id, 0);
    return;
  }

  // 水平滑動處理
  if (meta.lockedAxis === 'x') {
    if (x <= DELETE_THRESHOLD) {
      // 超過閾值，觸發編輯後回位
      onEditById(id);
      // 延遲回位，讓編輯視窗先開啟
      setTimeout(() => {
        snapWithTransition(id, 0);
      }, 100);
      return;
    }
    // 未達觸發閾值，一律回位
    snapWithTransition(id, 0);
  } else {
    // 未明確鎖定但已移動，回位到 0
    snapWithTransition(id, 0);
  }
};

// Touch handlers for mobile support
const onFavTouchStart = (e: TouchEvent, id: string) => {
  const t = e.touches[0];
  if (!t) return;
  onFavPointerDown({ clientX: t.clientX, clientY: t.clientY } as any, id);
};

const onFavTouchMove = (e: TouchEvent, id: string) => {
  const t = e.touches[0];
  if (!t) return;
  // Forward preventDefault to underlying handler
  onFavPointerMove(
    { clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault() } as any,
    id
  );
};

const onFavTouchEnd = (_e: TouchEvent, id: string) => {
  onFavPointerUp({} as any, id);
};

const onEditById = (id: string) => {
  const f = tripStore.favorites.find((x) => x.id === id);
  if (f) openEditFavorite(f);
};

const onFavoriteItemClick = (f: SavedTrip) => {
  const id = f.id;
  const x = favoriteSwipeX.value[id] || 0;
  const dragging = favoriteDragState.value[id]?.moved;
  if (!dragging && Math.abs(x) < 5) applyFavorite(f);
};

const onSwitchOriginDestination = () => {
  const temp = originPlace.value;
  originPlace.value = destinationPlace.value;
  destinationPlace.value = temp;
  originInput.value = originPlace.value?.name || '';
  destinationInput.value = destinationPlace.value?.name || '';
};

// 確定行程，開始分析
const confirmRoute = () => {
  // 跳轉到分析載入頁面
  router.push({
    name: 'analysis-loading',
    query: {
      origin: originPlace.value?.name || '',
      destination: destinationPlace.value?.name || '',
      originLat: originPlace.value?.lat?.toString() || '',
      originLng: originPlace.value?.lng?.toString() || '',
      destLat: destinationPlace.value?.lat?.toString() || '',
      destLng: destinationPlace.value?.lng?.toString() || ''
    }
  });
};

// 重新規劃：清空起點和終點
const replanRoute = () => {
  // originPlace.value = null;
  destinationPlace.value = null;
  // originInput.value = '';
  destinationInput.value = '';
  selectedDest.value = true;
  // 清除路線：從地圖移除 renderer 再重新設置以清除所有路線
  if (directionsRenderer && map) {
    directionsRenderer.setDirections({ routes: [] } as any);
  }
  // 清除起終點標記，恢復顯示站點標記
  clearMarkers();
  if (searchSpotList.value.length > 0) {
    updateMarkers();
  }
};
</script>

<template>
  <div class="h-screen">
    <div>
      <!-- 地圖 -->
      <div class="relative flex-1 h-full overflow-y-hidden">
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
          class="bg-white rounded-t-2xl shadow-[0_-4px_10px_rgba(0,0,0,0.04)]"
          :style="{ height: sheetHeight + 'px' }"
        >
          <!-- drag handle -->
          <div
            v-if="!isRouteReady"
            class="w-full flex items-center justify-center pt-2 cursor-grab select-none"
            @mousedown="onHandleMouseDown"
            @touchstart="onHandleTouchStart"
          >
            <div class="w-8 h-1.5 bg-grey-300 rounded-full"></div>
          </div>

          <!-- 當起點和終點都已設定時，顯示確認面板 -->
          <template v-if="isRouteReady">
            <div class="px-4 py-4 flex flex-col gap-3">
              <!-- 確定行程, 開始分析 按鈕 -->
              <button
                @click="confirmRoute"
                class="w-full flex items-center justify-center gap-2 bg-primary-100 text-primary-500 font-bold py-4 rounded-xl shadow-lg hover:opacity-90 transition-opacity"
              >
                <img src="@/assets/images/icon-run.svg" class="w-5 h-5" alt="" />
                <span>確定行程, 開始分析</span>
              </button>
              <!-- 重新規劃 按鈕 -->
              <button @click="replanRoute" class="w-full text-center text-red-500 font-medium py-2">
                重新規劃
              </button>
            </div>
          </template>

          <!-- 原本的內容：當起點或終點未設定時顯示 -->
          <template v-else>
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
                {{ s.name }}
              </button>
            </div>

            <!-- 起點 / 目的地 輸入 -->
            <div class="px-4 mt-3">
              <div
                class="sheet-card flex flex-row items-center justify-center rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] p-2 gap-2"
              >
                <!--  兩個icon切換 依照 selectedDest 來切換 -->
                <div class="w-7 grid" style="min-height: 28px">
                  <!-- route-icon -->
                  <img
                    src="@/assets/images/route-icon.svg"
                    class="w-7 h-auto icon-transition"
                    style="grid-area: 1/1"
                    :class="{
                      'z-20 icon-ease-in': selectedDest,
                      'z-0 icon-ease-out': !selectedDest
                    }"
                    alt=""
                  />
                  <!-- route-icon-reverted -->
                  <img
                    src="@/assets/images/route-icon-reverted.svg"
                    class="w-7 h-auto icon-transition"
                    style="grid-area: 1/1"
                    :class="{
                      'z-20 icon-ease-in': !selectedDest,
                      'z-0 icon-ease-out': selectedDest
                    }"
                    alt=""
                  />
                </div>
                <div class="flex flex-col items-center justify-center w-full relative">
                  <!-- Sliding background -->
                  <div
                    class="absolute top-0 left-0 w-full h-[calc(50%-0.125rem)] rounded-lg bg-primary-50 transition-transform duration-300 ease-in-out"
                    :style="{
                      transform: selectedDest ? 'translateY(calc(100% + 0.25rem))' : 'translateY(0)'
                    }"
                  ></div>
                  <div
                    class="rounded-lg p-2 cursor-pointer w-full relative z-10 transition-colors duration-300"
                    :class="{
                      // 'border-2 border-primary-500': !selectedDest,
                      // 'border-2 border-transparent': selectedDest
                    }"
                    @click="
                      selectedDest = false;
                      originInputEl && originInputEl.focus();
                    "
                  >
                    <div class="text-sm text-grey-700">起始站</div>
                    <input
                      ref="originInputEl"
                      v-model="originInput"
                      placeholder="點按以選擇起始站"
                      class="w-full bg-transparent outline-none"
                      @click.stop="selectedDest = false"
                      @keydown.enter.prevent
                    />
                  </div>
                  <!-- <div class="mx-2 h-0.5 w-full bg-grey-200"></div> -->
                  <div
                    class="rounded-lg p-2 mx-2 cursor-pointer w-full relative z-10 transition-colors duration-300"
                    :class="{
                      // 'border-2 border-primary-500': selectedDest,
                      // 'border-2 border-transparent': !selectedDest
                    }"
                    @click="
                      selectedDest = true;
                      destinationInputEl && destinationInputEl.focus();
                    "
                  >
                    <div class="text-sm text-grey-700">終點站</div>
                    <input
                      ref="destinationInputEl"
                      v-model="destinationInput"
                      placeholder="點按以選擇終點站"
                      class="w-full bg-transparent outline-none"
                      @click.stop="selectedDest = true"
                      @keydown.enter.prevent
                    />
                  </div>
                </div>
                <img
                  src="@/assets/images/icon-switch.svg"
                  class="w-7 h-auto cursor-pointer"
                  alt=""
                  @click="onSwitchOriginDestination"
                />
              </div>
            </div>

            <!-- 歷史 / 常用 切換 + 列表 -->
            <div class="px-4 mt-4">
              <!-- Segmented toggle -->
              <div class="bg-white rounded-full p-1 mb-3 flex border border-grey-200 relative">
                <!-- Sliding background -->
                <div
                  class="absolute top-1 left-1 w-[calc(50%-0.125rem)] h-[calc(100%-0.5rem)] rounded-full bg-primary-100 shadow transition-transform duration-500 ease-in-out"
                  :style="{
                    transform:
                      activeList === 'history'
                        ? 'translateX(0)'
                        : 'translateX(calc(100% + 0.25rem))'
                  }"
                ></div>
                <button
                  class="flex-1 flex items-center justify-center py-2 rounded-full font-bold relative z-10 transition-colors duration-500"
                  :class="{
                    'text-white': activeList === 'history',
                    'text-grey-600': activeList !== 'history'
                  }"
                  @click="activeList = 'history'"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    class="w-5 h-5 mr-1 fill-current"
                    :class="{
                      'text-primary-500': activeList === 'history',
                      'text-grey-600': activeList !== 'history'
                    }"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <mask
                      id="mask0_2068_2082"
                      style="mask-type: alpha"
                      maskUnits="userSpaceOnUse"
                      x="0"
                      y="0"
                      width="24"
                      height="24"
                    >
                      <rect width="24" height="24" fill="currentColor" />
                    </mask>
                    <g mask="url(#mask0_2068_2082)">
                      <path
                        d="M12 21C9.7 21 7.69583 20.2375 5.9875 18.7125C4.27917 17.1875 3.3 15.2833 3.05 13H5.1C5.33333 14.7333 6.10417 16.1667 7.4125 17.3C8.72083 18.4333 10.25 19 12 19C13.95 19 15.6042 18.3208 16.9625 16.9625C18.3208 15.6042 19 13.95 19 12C19 10.05 18.3208 8.39583 16.9625 7.0375C15.6042 5.67917 13.95 5 12 5C10.85 5 9.775 5.26667 8.775 5.8C7.775 6.33333 6.93333 7.06667 6.25 8H9V10H3V4H5V6.35C5.85 5.28333 6.8875 4.45833 8.1125 3.875C9.3375 3.29167 10.6333 3 12 3C13.25 3 14.4208 3.2375 15.5125 3.7125C16.6042 4.1875 17.5542 4.82917 18.3625 5.6375C19.1708 6.44583 19.8125 7.39583 20.2875 8.4875C20.7625 9.57917 21 10.75 21 12C21 13.25 20.7625 14.4208 20.2875 15.5125C19.8125 16.6042 19.1708 17.5542 18.3625 18.3625C17.5542 19.1708 16.6042 19.8125 15.5125 20.2875C14.4208 20.7625 13.25 21 12 21ZM14.8 16.2L11 12.4V7H13V11.6L16.2 14.8L14.8 16.2Z"
                        fill="currentColor"
                      />
                    </g>
                  </svg>
                  <span
                    :class="{
                      'text-primary-500': activeList === 'history',
                      'text-grey-600': activeList !== 'history'
                    }"
                  >
                    歷史站點
                  </span>
                </button>
                <button
                  class="flex-1 flex items-center justify-center py-2 rounded-full font-bold relative z-10 transition-colors duration-300"
                  :class="{
                    'text-white': activeList === 'favorite',
                    'text-grey-600': activeList !== 'favorite'
                  }"
                  @click="activeList = 'favorite'"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    class="w-5 h-5 mr-1 fill-current"
                    :class="{
                      'text-primary-500': activeList === 'favorite',
                      'text-grey-600': activeList !== 'favorite'
                    }"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M11.245 4.32326C11.4765 3.65734 11.5922 3.32439 11.7634 3.23211C11.9115 3.15224 12.0898 3.15224 12.238 3.23211C12.4091 3.32439 12.5248 3.65734 12.7563 4.32326L14.2866 8.72565C14.3525 8.91518 14.3854 9.00994 14.4448 9.08051C14.4972 9.14285 14.5641 9.19144 14.6396 9.22204C14.725 9.25669 14.8253 9.25873 15.0259 9.26282L19.6857 9.35778C20.3906 9.37214 20.743 9.37933 20.8837 9.51358C21.0054 9.62977 21.0605 9.7994 21.0303 9.96495C20.9955 10.1563 20.7146 10.3692 20.1528 10.7952L16.4387 13.6109C16.2788 13.7322 16.1989 13.7928 16.1501 13.871C16.107 13.9402 16.0815 14.0188 16.0757 14.1C16.0692 14.192 16.0982 14.288 16.1563 14.4801L17.506 18.9412C17.7101 19.616 17.8122 19.9534 17.728 20.1286C17.6551 20.2803 17.5108 20.3851 17.344 20.4076C17.1513 20.4335 16.862 20.2322 16.2833 19.8295L12.4576 17.1674C12.2929 17.0528 12.2106 16.9955 12.1211 16.9732C12.042 16.9536 11.9593 16.9536 11.8803 16.9732C11.7908 16.9955 11.7084 17.0528 11.5437 17.1674L7.71805 19.8295C7.13937 20.2322 6.85003 20.4335 6.65733 20.4076C6.49056 20.3851 6.34626 20.2803 6.27337 20.1286C6.18915 19.9534 6.29123 19.616 6.49538 18.9412L7.84503 14.4801C7.90313 14.288 7.93218 14.192 7.92564 14.1C7.91986 14.0188 7.89432 13.9402 7.85123 13.871C7.80246 13.7928 7.72251 13.7322 7.56262 13.6109L3.84858 10.7952C3.28678 10.3692 3.00588 10.1563 2.97101 9.96495C2.94082 9.7994 2.99594 9.62977 3.11767 9.51358C3.25831 9.37933 3.61074 9.37215 4.31559 9.35778L8.9754 9.26282C9.176 9.25873 9.27631 9.25669 9.36177 9.22204C9.43726 9.19144 9.50414 9.14285 9.55657 9.08051C9.61593 9.00994 9.64887 8.91518 9.71475 8.72565L11.245 4.32326Z"
                      stroke="#D9D9D9"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <span
                    :class="{
                      'text-primary-500': activeList === 'favorite',
                      'text-grey-600': activeList !== 'favorite'
                    }"
                  >
                    常用行程
                  </span>
                </button>
              </div>

              <ul
                class="overflow-y-auto divide-y divide-grey-200"
                :style="{ maxHeight: sheetHeight - 240 + 'px' }"
              >
                <template v-if="activeList === 'history'">
                  <li
                    v-for="h in tripStore.histories"
                    :key="h.id"
                    class="py-3 cursor-pointer"
                    @click="() => applyHistoryStation(h)"
                  >
                    <div>
                      <div class="text-grey-900 font-extrabold">
                        {{ h.place?.name }}
                      </div>
                      <div class="text-grey-500 text-sm flex items-center">
                        <span
                          v-if="
                            distanceKm(
                              currentLocation.lat,
                              currentLocation.lng,
                              Number(spotById(h.id)?.lat as any),
                              Number(spotById(h.id)?.lng as any)
                            ) !== null
                          "
                        >
                          {{
                            distanceKm(
                              currentLocation.lat,
                              currentLocation.lng,
                              Number(spotById(h.id)?.lat as any),
                              Number(spotById(h.id)?.lng as any)
                            )?.toFixed(1)
                          }}
                          <span>公里</span>
                        </span>
                        <span class="mx-2">|</span>
                        <span class="flex">
                          <template
                            v-if="
                              (spotById(h.id)?.available_rent_bikes ?? 0) !== 0 &&
                              (spotById(h.id)?.available_return_bikes ?? 0) !== 0
                            "
                          >
                            <img
                              src="/public/images/map/youbike/icon-info-ubike-green.svg"
                              alt=""
                            />
                            <span class="ml-1 text-[#76A732]">正常租借</span>
                          </template>
                          <template v-else-if="(spotById(h.id)?.available_rent_bikes ?? 0) === 0">
                            <img
                              src="/public/images/map/youbike/icon-info-ubike-yellow.svg"
                              alt=""
                            />
                            <span class="ml-1 text-secondary-500">無車可借</span>
                          </template>
                          <template v-else-if="(spotById(h.id)?.available_return_bikes ?? 0) === 0">
                            <img src="/public/images/map/youbike/icon-info-ubike-red.svg" alt="" />
                            <span class="ml-1 text-[#E5464B]"> 車位滿載</span>
                          </template>
                        </span>
                        <span class="mx-2">|</span>
                        <span>
                          <span class="text-grey-500 mr-1">可借</span>
                          <span
                            class="mr-1"
                            :class="
                              (spotById(h.id)?.available_rent_bikes ?? 0) === 0
                                ? 'text-secondary-500'
                                : 'text-[#76A732]'
                            "
                          >
                            {{ spotById(h.id)?.available_rent_bikes ?? 0 }}
                          </span>
                          <span class="text-grey-500 mr-1">可停</span>
                          <span
                            :class="
                              (spotById(h.id)?.available_return_bikes ?? 0) === 0
                                ? 'text-[#E5464B]'
                                : 'text-grey-950'
                            "
                          >
                            {{ spotById(h.id)?.available_return_bikes ?? 0 }}
                          </span>
                        </span>
                      </div>
                    </div>
                  </li>
                  <li v-if="!tripStore.histories.length" class="text-grey-500 text-sm py-3">
                    目前沒有歷史紀錄
                  </li>
                </template>
                <template v-else>
                  <li
                    v-for="f in tripStore.favorites"
                    :key="f.id"
                    class="relative overflow-hidden cursor-pointer"
                    @click="onFavoriteItemClick(f)"
                  >
                    <!-- Delete Underlay -->
                    <div
                      class="absolute inset-0 flex items-center rounded-lg justify-end pr-4 bg-primary-100"
                    >
                      <button
                        class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
                        @click.stop="onEditById(f.id)"
                      >
                        <img src="@/assets/images/icon-edit.svg" class="w-5 h-5" />
                      </button>
                    </div>

                    <!-- Draggable Card -->
                    <div
                      class="bg-white rounded-e-lg shadow px-3 py-3 will-change-transform flex items-center justify-between"
                      :style="{
                        transform: `translateX(${favoriteSwipeX[f.id] || 0}px)`,
                        transition: favoriteTransition[f.id] ? 'transform 180ms ease' : 'none'
                      }"
                      @pointerdown="onFavPointerDown($event, f.id)"
                      @pointermove="onFavPointerMove($event, f.id)"
                      @pointerup="onFavPointerUp($event, f.id)"
                      @pointercancel="onFavPointerUp($event, f.id)"
                      @pointerleave="onFavPointerUp($event, f.id)"
                      @touchstart="onFavTouchStart($event, f.id)"
                      @touchmove="onFavTouchMove($event, f.id)"
                      @touchend="onFavTouchEnd($event, f.id)"
                      @touchcancel="onFavTouchEnd($event, f.id)"
                    >
                      <div>
                        <div class="text-grey-900 font-extrabold">{{ f.name }}</div>
                        <div class="text-grey-500 text-sm flex items-center">
                          <span>{{ f.origin?.name }}</span>
                          <span class="mx-1">→</span>
                          <span>{{ f.destination?.name }}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                  <li v-if="!tripStore.favorites.length" class="text-grey-500 text-sm py-3">
                    尚無常用行程
                  </li>
                  <li class="py-4">
                    <button
                      class="w-full flex items-center justify-center gap-2 bg-primary-100 text-primary-600 rounded-full py-3 shadow"
                      @click="() => (showFavoriteDialog = true)"
                    >
                      <img src="@/assets/images/icon-add.svg" class="w-4 h-4" />
                      <span class="font-bold text-primary-500">新增常用行程</span>
                    </button>
                  </li>
                </template>
              </ul>
            </div>
          </template>
        </div>
      </div>
      <!-- 選取的點 -->
      <div
        v-if="selectedSpot"
        class="floating-box bottom-24 left-[50%] translate-x-[-50%] w-[90%]"
        :style="{ bottom: sheetHeight + 10 + 'px', top: 'auto' }"
      >
        <div>
          <!-- title -->
          <div class="flex items-center mb-2">
            <span class="font-bold text-xl">{{ selectedSpot.sna }}</span>
          </div>
          <div class="flex items-center mb-2 gap-1">
            <img src="@/assets/images/icon-geo.svg" alt="" />
            <p class="text-grey-500 text-sm">{{ selectedSpot.sarea }}</p>
          </div>
          <div class="flex text-grey-500 mb-2">
            <span>{{ selectedSpot.distance }}公里</span>
            <span class="mx-2">|</span>
            <span class="flex">
              <template
                v-if="
                  selectedSpot.available_rent_bikes !== 0 &&
                  selectedSpot.available_return_bikes !== 0
                "
              >
                <img src="/public/images/map/youbike/icon-info-ubike-green.svg" alt="" />
                <span class="ml-1 text-[#76A732]">正常租借</span>
              </template>
              <template v-if="selectedSpot.available_rent_bikes === 0">
                <img src="/public/images/map/youbike/icon-info-ubike-yellow.svg" alt="" />
                <span class="ml-1 text-secondary-500">無車可借</span>
              </template>
              <template v-if="selectedSpot.available_return_bikes === 0">
                <img src="/public/images/map/youbike/icon-info-ubike-red.svg" alt="" />
                <span class="ml-1 text-[#E5464B]"> 車位滿載</span>
              </template>
            </span>
            <span class="mx-2">|</span>
            <span>
              <span class="text-grey-500 mr-1">可借</span>
              <span
                class="mr-1"
                :class="
                  selectedSpot.available_rent_bikes === 0 ? 'text-secondary-500' : 'text-[#76A732]'
                "
              >
                {{ selectedSpot.available_rent_bikes }}
              </span>
              <span class="text-grey-500 mr-1">可停</span>
              <span
                :class="
                  selectedSpot.available_return_bikes === 0 ? 'text-[#E5464B]' : 'text-grey-950'
                "
              >
                {{ selectedSpot.available_return_bikes }}
              </span>
            </span>
          </div>
        </div>
        <button @click="selectCurrentSpot">
          <img src="@/assets/images/icon-right.svg" class="w-xl h-xl" alt="" />
        </button>
      </div>
    </div>
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
    negative-text="刪除"
    is-favorite-dialog
    @onPositiveClick="saveFavorite"
    @onNegativeClick="deleteFavorite"
  >
    <template #content>
      <div class="favorite-dialog-content">
        <!-- 標題 -->
        <h2 class="favorite-dialog-title">新增常用行程</h2>

        <!-- 表單內容 -->
        <div class="favorite-dialog-form">
          <div class="favorite-dialog-field">
            <label class="favorite-dialog-label">行程名稱</label>
            <input
              v-model="newFavoriteName"
              type="text"
              placeholder="如:回溫暖ㄉ家"
              class="favorite-dialog-input"
            />
          </div>
          <div class="favorite-dialog-field">
            <label class="favorite-dialog-label">起始點</label>
            <input
              :value="favoriteOriginName"
              type="text"
              placeholder="點選以輸入"
              class="favorite-dialog-input"
              readonly
            />
          </div>
          <div class="favorite-dialog-field">
            <label class="favorite-dialog-label">終點站</label>
            <input
              :value="favoriteDestinationName"
              type="text"
              placeholder="點選以輸入"
              class="favorite-dialog-input"
              readonly
            />
          </div>
          <div class="favorite-dialog-checkbox">
            <input
              id="pinHome"
              type="checkbox"
              v-model="pinToHome"
              class="favorite-dialog-checkbox-input"
            />
            <label for="pinHome" class="favorite-dialog-checkbox-label">釘選至主頁</label>
          </div>
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

/* 新增常用行程 Dialog 樣式 */
.favorite-dialog-content {
  background-color: transparent;
}

.favorite-dialog-title {
  text-align: center;
  font-size: 1.25rem;
  font-weight: 800;
  color: #171b1d; /* grey-900 */
  padding: 20px 16px 16px 16px;
  margin: 0;
}

.favorite-dialog-form {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.favorite-dialog-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.favorite-dialog-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: #171b1d; /* grey-900 */
  text-align: left;
}

.favorite-dialog-input {
  width: 100%;
  padding: 10px 12px;
  background-color: white;
  border: 1px solid #adb8be; /* grey-300 */
  border-radius: 8px;
  font-size: 0.875rem;
  outline: none;
}

.favorite-dialog-input::placeholder {
  color: #adb8be; /* grey-300 */
}

.favorite-dialog-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.favorite-dialog-checkbox-input {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 1px solid #adb8be;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
}

.favorite-dialog-checkbox-input:checked {
  background-color: #2eb6c7; /* primary-500 */
  border-color: #2eb6c7;
}

.favorite-dialog-checkbox-input:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 14px;
  font-weight: bold;
}

.favorite-dialog-checkbox-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #2eb6c7; /* grey-900 */
  cursor: pointer;
}

/* Icon transition styles */
.icon-transition {
  transition:
    -webkit-mask-position 0.3s ease-in-out,
    mask-position 0.3s ease-in-out,
    opacity 0.3s ease-in-out;
  -webkit-mask-size: 100% 200%;
  mask-size: 100% 200%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}

/* 頂層圖標 (ease in) - 由下而上漸層顯示 */
.icon-ease-in {
  -webkit-mask-image: linear-gradient(to top, transparent 0%, black 100%);
  mask-image: linear-gradient(to top, transparent 0%, black 100%);
  -webkit-mask-position: 0% 0%;
  mask-position: 0% 0%;
  opacity: 1;
}

/* 底層圖標 (ease out) - 由上而下漸層隱藏 */
.icon-ease-out {
  -webkit-mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
  -webkit-mask-position: 0% 0%;
  mask-position: 0% 0%;
  opacity: 0;
}
</style>
