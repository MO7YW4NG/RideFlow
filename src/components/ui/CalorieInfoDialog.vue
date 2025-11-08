<script setup lang="ts">
import { Dialog, DialogPanel, TransitionRoot, TransitionChild } from '@headlessui/vue';

const isOpen = defineModel<boolean>({ default: false });

const closeDialog = () => {
  isOpen.value = false;
};
</script>

<template>
  <TransitionRoot appear :show="isOpen" as="template">
    <Dialog as="div" :open="isOpen" @close="closeDialog" class="relative z-[9999]">
      <div
        class="fixed inset-0 bg-black/25"
        @click.self="closeDialog"
        @touchstart.self="closeDialog"
      >
        <div class="min-h-full flex justify-center items-center">
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
              class="w-4/5 max-w-screen-md flex flex-col transform overflow-y-auto transition-all bg-white pt-4 rounded-xl"
            >
              <div class="px-2 my-5">
                <div class="calorie-info-dialog-content">
                  <!-- 標題 -->
                  <div class="flex items-center gap-2 mb-6">
                    <div class="w-1 h-5 bg-primary-500 rounded"></div>
                    <h3 class="text-base font-extrabold text-grey-900">騎乘卡路里試算</h3>
                  </div>

                  <!-- 定義 -->
                  <div class="mb-6">
                    <div class="flex items-center gap-2 mb-3">
                      <div class="flex-shrink-0">
                        <div
                          class="w-5 h-5 rounded-full border-2 border-[#76A732] flex items-center justify-center"
                        >
                          <div class="w-2.5 h-2.5 rounded-full bg-[#76A732]"></div>
                        </div>
                      </div>
                      <h4 class="text-sm font-bold text-grey-900">定義</h4>
                    </div>
                    <div class="text-xs text-grey-700 leading-relaxed pl-7 space-y-1">
                      <p>
                        依據衛生福利部2017-2020年身高、體重、身體質量指數資料集。本系統採用平均體重進行預估:
                      </p>
                      <p>
                        <span class="font-bold text-grey-900">男性(19-44歲)75.4公斤</span>
                      </p>
                      <p>
                        <span class="font-bold text-grey-900">女性(19-44歲)58.7公斤</span>
                      </p>
                      <div class="h-px bg-grey-200 my-2"></div>
                      <p>
                        以腳踏車休閒騎乘(8-16km/h)為基準,METs 為
                        <span class="font-bold text-grey-900">5</span>
                      </p>
                    </div>
                  </div>

                  <!-- 卡路里計算公式 -->
                  <div class="mb-6">
                    <div class="flex items-center gap-2 mb-3">
                      <div class="flex-shrink-0">
                        <div
                          class="w-5 h-5 rounded-full border-2 border-primary-500 flex items-center justify-center"
                        >
                          <div class="w-2.5 h-2.5 rounded-full bg-primary-500"></div>
                        </div>
                      </div>
                      <h4 class="text-sm font-bold text-grey-900">卡路里計算公式</h4>
                    </div>
                    <div class="text-xs text-grey-700 leading-relaxed pl-7 space-y-1">
                      <p class="font-bold text-grey-900">消耗熱量(kcal)</p>
                      <p class="font-bold text-grey-900 whitespace-nowrap">=METs × 體重(kg) × 運動時間(小時) × 1.05</p>
                    </div>
                  </div>

                  <!-- 注意事項 -->
                  <div>
                    <div class="flex items-center gap-2 mb-3">
                      <div class="flex-shrink-0">
                        <div
                          class="w-5 h-5 rounded-full border-2 border-orange-500 flex items-center justify-center"
                        >
                          <div class="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                        </div>
                      </div>
                      <h4 class="text-sm font-bold text-grey-900">注意事項</h4>
                    </div>
                    <div class="text-xs text-grey-700 leading-relaxed pl-7">
                      結果僅供參考,實際消耗量會因地形、風阻及個人體能差異而變化。
                    </div>
                  </div>
                </div>
              </div>

              <!-- 確認按鈕 -->
              <div class="mt-auto py-2 my-2 flex justify-center items-center px-8">
                <button
                  type="button"
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

<style lang="postcss" scoped>
.calorie-info-dialog-content {
  padding: 0 16px 16px;
  max-height: 70vh;
  overflow-y: auto;
}
</style>

