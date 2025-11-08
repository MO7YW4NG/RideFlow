<script setup lang="ts">
import { Dialog, DialogPanel, TransitionRoot, TransitionChild } from '@headlessui/vue';
import weatherAlertIcon from '@/assets/images/icon-weather-alert.svg';


interface WeatherAlert {
  title: string; // 例如: "豪大雨特報"
  location: string; // 例如: "臺北市"
  startTime: string; // 例如: "2025-11-06 10:34"
  endTime: string; // 例如: "2025-11-07 23:00"
}


const props = defineProps<{
  alert: WeatherAlert | null;
}>();

const isOpen = defineModel<boolean>({ default: false });

const closeDialog = () => {
  isOpen.value = false;
};
</script>

<template>
  <TransitionRoot appear :show="isOpen && alert !== null" as="template">
    <Dialog as="div" :open="isOpen && alert !== null" @close="closeDialog" class="relative z-[9999]">
      <div
        class="fixed inset-0 bg-black/25"
        @click.self="closeDialog"
        @touchstart.self="closeDialog"
      >
        <div class="min-h-full flex justify-center items-center px-4">
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel
              class="w-full max-w-sm flex flex-col transform overflow-hidden transition-all bg-white rounded-xl shadow-lg border-2 border-dashed border-primary-200"
            >
              <!-- 內容區域 -->
              <div class="px-6 py-8 flex flex-col items-center">
                <!-- 警告圖標 -->
                <div class="w-20 h-20 rounded-full flex items-center justify-center mb-5">
                  <img :src="weatherAlertIcon" alt="天氣特報" class="w-24 h-24">
                </div>

                <!-- 標題 -->
                <h2 class="text-2xl font-extrabold text-red-600 mb-4 text-center">
                  {{ alert?.title || '' }}
                </h2>

                <!-- 位置 -->
                <p class="text-lg font-medium text-grey-900 mb-5 text-center">
                  {{ alert?.location || '' }}
                </p>

                <!-- 時間資訊 -->
                <div class="w-full space-y-2.5 mb-7">
                  <div class="text-sm text-grey-900 text-center">
                    開始時間 : {{ alert?.startTime || '' }}
                  </div>
                  <div class="text-sm text-grey-900 text-center">
                    結束時間 : {{ alert?.endTime || '' }}
                  </div>
                </div>

                <!-- 確認按鈕 -->
                <button
                  @click="closeDialog"
                  class="bg-secondary-200 text-secondary-800 px-20 py-2 rounded-lg font-bold shadow-sm hover:opacity-90 transition-opacity"
                >
                  確認
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<style scoped>
/* 如果需要額外的樣式可以添加 */
</style>

