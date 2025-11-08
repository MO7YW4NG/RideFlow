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
                <div class="aqi-uvi-dialog-content">
                  <!-- AQI 空氣品質指標 -->
                  <div class="mb-6">
                    <div class="flex items-center gap-2 mb-4">
                      <div class="w-1 h-5 bg-primary-500 rounded"></div>
                      <h3 class="text-base font-extrabold text-grey-900">AQI 空氣品質指標</h3>
                    </div>
                    <div class="space-y-3">
                      <!-- 0-50 -->
                      <div class="flex items-start gap-3">
                        <div class="flex-shrink-0 mt-1">
                          <div
                            class="w-5 h-5 rounded-full border-2 border-[#76A732] flex items-center justify-center"
                          >
                            <div class="w-2.5 h-2.5 rounded-full bg-[#76A732]"></div>
                          </div>
                        </div>
                        <div class="flex-1">
                          <div class="text-sm font-bold text-grey-900 mb-1">0-50</div>
                          <div class="text-xs text-grey-700 leading-relaxed">
                            空氣污染程度低或無污染，可正常戶外活動
                          </div>
                        </div>
                      </div>
                      <!-- 51-100 -->
                      <div class="flex items-start gap-3">
                        <div class="flex-shrink-0 mt-1">
                          <div
                            class="w-5 h-5 rounded-full border-2 border-primary-500 flex items-center justify-center"
                          >
                            <div class="w-2.5 h-2.5 rounded-full bg-primary-500"></div>
                          </div>
                        </div>
                        <div class="flex-1">
                          <div class="text-sm font-bold text-grey-900 mb-1">51-100</div>
                          <div class="text-xs text-grey-700 leading-relaxed">
                            對少數極敏感族群產生輕微影響，可能產生的咳嗽或呼吸急促症狀，尚可正常戶外活動
                          </div>
                        </div>
                      </div>
                      <!-- 101以上 -->
                      <div class="flex items-start gap-3">
                        <div class="flex-shrink-0 mt-1">
                          <div
                            class="w-5 h-5 rounded-full border-2 border-orange-500 flex items-center justify-center"
                          >
                            <div class="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                          </div>
                        </div>
                        <div class="flex-1">
                          <div class="text-sm font-bold text-grey-900 mb-1">101以上</div>
                          <div class="text-xs text-grey-700 leading-relaxed">
                            空氣污染會影響敏感族群的健康。學生應避免長時間戶外運動。慢性病患者、幼童與長者建議留在室內
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- UVI 紫外線指數 -->
                  <div>
                    <div class="flex items-center gap-2 mb-4">
                      <div class="w-1 h-5 bg-primary-500 rounded"></div>
                      <h3 class="text-base font-extrabold text-grey-900">UVI 紫外線指數</h3>
                    </div>
                    <div class="space-y-3">
                      <!-- 0-2 -->
                      <div class="flex items-start gap-3">
                        <div class="flex-shrink-0 mt-1">
                          <div
                            class="w-5 h-5 rounded-full border-2 border-[#76A732] flex items-center justify-center"
                          >
                            <div class="w-2.5 h-2.5 rounded-full bg-[#76A732]"></div>
                          </div>
                        </div>
                        <div class="flex-1">
                          <div class="text-sm font-bold text-grey-900 mb-1">0-2</div>
                          <div class="text-xs text-grey-700 leading-relaxed">對於一般人無危險</div>
                        </div>
                      </div>
                      <!-- 3-5 -->
                      <div class="flex items-start gap-3">
                        <div class="flex-shrink-0 mt-1">
                          <div
                            class="w-5 h-5 rounded-full border-2 border-primary-500 flex items-center justify-center"
                          >
                            <div class="w-2.5 h-2.5 rounded-full bg-primary-500"></div>
                          </div>
                        </div>
                        <div class="flex-1">
                          <div class="text-sm font-bold text-grey-900 mb-1">3-5</div>
                          <div class="text-xs text-grey-700 leading-relaxed">
                            無保護暴露於陽光中有較輕傷害的風險，正午陽光需防護措施
                          </div>
                        </div>
                      </div>
                      <!-- 6以上 -->
                      <div class="flex items-start gap-3">
                        <div class="flex-shrink-0 mt-1">
                          <div
                            class="w-5 h-5 rounded-full border-2 border-orange-500 flex items-center justify-center"
                          >
                            <div class="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                          </div>
                        </div>
                        <div class="flex-1">
                          <div class="text-sm font-bold text-grey-900 mb-1">6以上</div>
                          <div class="text-xs text-grey-700 leading-relaxed">
                            30分鐘內會曬傷，建議做好防護措施
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 確認按鈕 - 完全居中 -->
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
.aqi-uvi-dialog-content {
  padding: 0 16px 16px;
  max-height: 70vh;
  overflow-y: auto;
}
</style>

