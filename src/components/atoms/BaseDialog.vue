<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, TransitionRoot, TransitionChild } from '@headlessui/vue';

const props = defineProps<{
  title?: string;
  content: string;
  isSlot?: boolean;
  negativeText?: string;
  positiveText?: string;
  isAlert?: boolean;
  isCheck?: boolean;
  isError?: boolean;
  isFavoriteDialog?: boolean; // 新增常用行程 Dialog 樣式
}>();

const emit = defineEmits(['onPositiveClick', 'onNegativeClick']);

const isOpen = defineModel({ default: false });

const setIsOpen = () => {
  isOpen.value = true;
};
const closeDialog = () => {
  isOpen.value = false;
};
const onPositiveClick = () => {
  isOpen.value = false;
  emit('onPositiveClick');
};

const onNegativeClick = () => {
  isOpen.value = false;
  emit('onNegativeClick');
};
</script>

<template>
  <TransitionRoot appear :show="isOpen" as="template">
    <Dialog as="div" :open="isOpen" @close="setIsOpen" class="relative z-[9999]">
      <div class="fixed inset-0 bg-black/25" @click="closeDialog" @touchstart="closeDialog">
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
              :class="[
                'w-4/5 max-w-screen-md flex flex-col transform overflow-y-auto transition-all bg-white pt-4 rounded-xl'
              ]"
            >
              <div v-if="props.isAlert" class="flex justify-center">
                <img src="@/assets/images/alert-icon.svg" class="w-24" />
              </div>
              <div v-else-if="props.isCheck" class="flex justify-center">
                <img src="@/assets/images/check-icon.svg" class="w-24" />
              </div>
              <div v-else-if="props.isError" class="flex justify-center">
                <img src="@/assets/images/cancel-icon.svg" class="w-24" />
              </div>
              <DialogTitle v-if="props.title" class="text-xl text-center font-extrabold">
                {{ title }}
              </DialogTitle>

              <div :class="props.isFavoriteDialog ? '' : 'px-4 my-5'">
                <p v-if="!props.isSlot" class="text-center font-bold whitespace-pre-line">
                  {{ props.content }}
                </p>
                <slot v-else name="content"></slot>
              </div>

              <div :class="['mt-auto py-2 my-2 grid grid-cols-2 px-8 gap-8']">
                <button
                  v-if="props.negativeText"
                  type="button"
                  :class="[
                    'flex justify-center items-center font-bold outline-none text-warn-200 py-2'
                  ]"
                  @click="onNegativeClick"
                >
                  {{ negativeText }}
                </button>
                <button
                  type="button"
                  :class="[
                    'flex justify-center items-center font-bold outline-none text-primary-500 py-2 border-2 rounded-lg bg-primary-100'
                  ]"
                  @click="onPositiveClick"
                >
                  {{ positiveText || '確認' }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
