import { ref } from 'vue';
import { defineStore } from 'pinia';

export interface ShortcutTrip {
  id: string;
  label: string; // e.g. 回家、上學、打工
  destination: {
    name: string;
    lat?: number;
    lng?: number;
    address?: string;
  } | null;
}

export interface SavedTrip {
  id: string;
  name: string; // 行程名稱
  origin: { name: string; lat?: number; lng?: number; address?: string } | null;
  destination: { name: string; lat?: number; lng?: number; address?: string } | null;
  pinToHome?: boolean;
}

export interface HistoryTrip {
  id: string;
  time: string; // ISO string
  origin: { name: string; lat?: number; lng?: number; address?: string } | null;
  destination: { name: string; lat?: number; lng?: number; address?: string } | null;
}

export const useTripStore = defineStore('trip', () => {
  // 預設三個快捷按鈕（可由後端/使用者設定覆蓋）
  const shortcuts = ref<ShortcutTrip[]>([
    { id: 'home', label: '回家', destination: null },
    { id: 'school', label: '上學', destination: null },
    { id: 'work', label: '打工', destination: null }
  ]);

  const favorites = ref<SavedTrip[]>([
    {
      id: crypto.randomUUID(),
      name: '回家路線',
      origin: { name: '市政府捷運站', lat: 25.040, lng: 121.566 },
      destination: { name: '信義區某住家', lat: 25.033, lng: 121.564 },
      pinToHome: true
    },
    {
      id: crypto.randomUUID(),
      name: '上學路線',
      origin: { name: '民生社區', lat: 25.058, lng: 121.554 },
      destination: { name: '台科大', lat: 25.013, lng: 121.541 },
      pinToHome: false
    },
    {
      id: crypto.randomUUID(),
      name: '打工路線',
      origin: { name: '古亭站', lat: 25.026, lng: 121.522 },
      destination: { name: '西門町', lat: 25.043, lng: 121.507 },
      pinToHome: false
    }
  ]);
  const histories = ref<HistoryTrip[]>([
    {
      id: crypto.randomUUID(),
      time: new Date().toISOString(),
      origin: { name: '南港展覽館', lat: 25.056, lng: 121.617 },
      destination: { name: '松山機場', lat: 25.069, lng: 121.552 }
    },
    {
      id: crypto.randomUUID(),
      time: new Date(Date.now() - 3600_000).toISOString(),
      origin: { name: '內湖科學園區', lat: 25.079, lng: 121.575 },
      destination: { name: '饒河街觀光夜市', lat: 25.050, lng: 121.578 }
    },
    {
      id: crypto.randomUUID(),
      time: new Date(Date.now() - 7200_000).toISOString(),
      origin: { name: '台北車站', lat: 25.0478, lng: 121.5170 },
      destination: { name: '台大公館', lat: 25.015, lng: 121.534 }
    }
  ]);

  const setShortcutDestination = (
    id: string,
    destination: NonNullable<ShortcutTrip['destination']>
  ) => {
    const target = shortcuts.value.find((s) => s.id === id);
    if (target) target.destination = destination;
  };

  const addFavorite = (trip: SavedTrip) => {
    favorites.value.unshift({ ...trip, id: crypto.randomUUID() });
  };

  const updateFavorite = (trip: SavedTrip) => {
    const idx = favorites.value.findIndex((f) => f.id === trip.id);
    if (idx >= 0) {
      favorites.value[idx] = { ...favorites.value[idx], ...trip };
    }
  };

  const addHistory = (trip: Omit<HistoryTrip, 'id' | 'time'>) => {
    histories.value.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), ...trip });
    // 僅保留最近 20 筆
    histories.value.splice(20);
  };

  return {
    shortcuts,
    favorites,
    histories,
    setShortcutDestination,
    addFavorite,
    updateFavorite,
    addHistory
  };
});


