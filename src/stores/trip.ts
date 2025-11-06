import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

// Shortcut 與 SavedTrip 統一：由 SavedTrip 中 pinToHome=true 的項目衍生

export interface SavedTrip {
  id: string;
  name: string; // 行程名稱
  origin: { id: string; name: string; lat?: number; lng?: number; address?: string } | null;
  destination: { id: string; name: string; lat?: number; lng?: number; address?: string } | null;
  pinToHome?: boolean;
}

export interface HistoryStation {
  id: string;
  time: string; // ISO string
  place: { name: string; lat?: number; lng?: number; address?: string } | null;
}

export const useTripStore = defineStore('trip', () => {
  // 快捷按鈕改為由 favorites 衍生（pinToHome=true）
  const shortcuts = computed(() => favorites.value.filter((f) => f.pinToHome));

  const favorites = ref<SavedTrip[]>([
    {
      id: crypto.randomUUID(),
      name: '回家',
      origin: { id: '500119047', name: '臺大土木系館', lat: 25.01761, lng: 121.53844 },
      destination: { id: '500101022', name: '捷運公館站(2號出口)', lat: 25.01491, lng: 121.53438 },
      pinToHome: true
    },
    {
      id: crypto.randomUUID(),
      name: '上學',
      origin: { id: '500106143', name: '螢橋國中', lat: 25.01933, lng: 121.52582 },
      destination: { id: '500106007', name: '捷運臺電大樓站(1號出口)', lat: 25.0197, lng: 121.529 },
      pinToHome: true
    },
    {
      id: crypto.randomUUID(),
      name: '打工',
      origin: { id: '500101001', name: '捷運科技大樓站', lat: 25.02605, lng: 121.5436 },
      destination: { id: '500101199', name: '和平新生路口西南側', lat: 25.02604, lng: 121.534 },
      pinToHome: true
    }
  ]);
  const histories = ref<HistoryStation[]>([
    {
      id: '500119065',
      time: new Date().toISOString(),
      place: { name: '臺大二號館', lat: 25.01699, lng: 121.53574 }
    },
    {
      id: '500119089',
      time: new Date(Date.now() - 3600_000).toISOString(),
      place: { name: '臺大獸醫館南側', lat: 25.01791, lng: 121.54242 }
    },
    {
      id: '500101207',
      time: new Date(Date.now() - 7200_000).toISOString(),
      place: { name: '捷運臺電大樓站(2號出口)_1', lat: 25.02055, lng: 121.52855 }
    }
  ]);

  // 不再直接設定 shortcuts，請透過更新 favorite 的 pinToHome 或內容來影響

  const addFavorite = (trip: SavedTrip) => {
    favorites.value.unshift({ ...trip, id: crypto.randomUUID() });
  };

  const updateFavorite = (trip: SavedTrip) => {
    const idx = favorites.value.findIndex((f) => f.id === trip.id);
    if (idx >= 0) {
      favorites.value[idx] = { ...favorites.value[idx], ...trip };
    }
  };

  const addHistory = (entry: Omit<HistoryStation, 'id' | 'time'>, stationId?: string) => {
    if (!entry.place?.name) return;
    // 先移除相同 key 的舊項目，確保 Ordered Set
    const idx = histories.value.findIndex((h) => {
      return h.id === stationId;
    });
    if (idx >= 0) histories.value.splice(idx, 1);
    histories.value.unshift({
      id: stationId ?? (entry as any).place?.id ?? entry.place.name,
      time: new Date().toISOString(),
      ...entry
    });
    // 僅保留最近 10 筆
    histories.value.splice(10);
  };

  const deleteFavorite = (id: string) => {
    const i = favorites.value.findIndex((f) => f.id === id);
    if (i >= 0) {
      favorites.value.splice(i, 1);
    }
  };

  return {
    shortcuts,
    favorites,
    histories,
    addFavorite,
    updateFavorite,
    deleteFavorite,
    addHistory
  };
});
