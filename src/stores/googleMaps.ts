import { ref } from 'vue';
import { defineStore } from 'pinia';
import { Loader } from '@googlemaps/js-api-loader';

export const useGoogleMapsStore = defineStore('googleMaps', () => {
  // 延遲載入：從 Worker 端點動態取得 API Key，避免在前端暴露
  let internalLoader: Loader | null = null;

  const loader = {
    async load() {
      if (!internalLoader) {
        // 從 Worker 端點獲取 API key
        const res = await fetch('/api/google-maps-key', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Failed to fetch Google Maps API key');
        }
        const data = await res.json();

        if (!data.apiKey) {
          throw new Error('Google Maps API key is not configured');
        }

        internalLoader = new Loader({
          apiKey: data.apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry']
        });
      }
      return internalLoader.load();
    }
  } as unknown as Loader;

  /**
   * 是否顯示未開啟取用位置權限通知
   */
  const showMapNotification = ref(false);

  /**
   * 獲取目前位置
   */
  const gettingPosition = () => {
    if (navigator.geolocation) {
      return new Promise((resolve, reject) => {
        const option = {
          enableAcuracy: false, // 提高精確度
          maximumAge: 0, // 設定上一次位置資訊的有效期限(毫秒)
          timeout: 10000 // 逾時計時器(毫秒)
        };
        navigator.geolocation.getCurrentPosition(resolve, reject, option);
      });
    } else {
      alert('Does not support positioning!');
    }
  };

  return {
    loader,
    showMapNotification,
    gettingPosition
  };
});
