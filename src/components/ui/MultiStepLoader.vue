<template>
  <Transition
    enter-active-class="transition-opacity duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-300"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="loading && steps.length > 0"
      class="fixed inset-0 z-[100] flex size-full items-center justify-center backdrop-blur-2xl"
    >
      <!-- Closing Button -->
      <button
        v-show="!preventClose"
        class="absolute right-4 top-4 z-[101] inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        size="sm"
        @click="close"
      >
        <!-- 關閉圖標 -->
        <img
          :src="iconCloseSrc"
          alt="關閉"
          class="size-6"
        />
      </button>
      <div class="relative h-96">
        <div class="relative mx-auto mt-40 flex max-w-xl flex-col justify-start">
          <div
            v-for="(step, index) in steps"
            :key="index"
          >
            <div
              v-if="step"
              class="mb-4 flex items-center gap-2 text-left transition-all duration-300 ease-in-out"
              :style="{
                opacity:
                  index === currentState
                    ? 1
                    : Math.max(1 - Math.abs(index - currentState) * 0.2, 0),
                transform: `translateY(${
                  index === currentState ? -(currentState * 40) : -(currentState * 40)
                }px)`,
              }"
            >
              <!-- 已完成步驟圖標 -->
              <img
                v-if="
                  index < currentState ||
                  (index === steps.length - 1 && index === currentState && isLastStepComplete)
                "
                :src="iconCompletedSrc"
                alt="已完成"
                class="size-6"
              />
              <!-- 載入中圖標 -->
              <img
                v-else-if="
                  index === currentState && (!isLastStepComplete || index !== steps.length - 1)
                "
                :src="iconLoadingSrc"
                alt="載入中"
                class="size-6 animate-spin"
              />
              <!-- 未開始步驟圖標 -->
              <img
                v-else
                :src="iconPendingSrc"
                alt="未開始"
                class="size-6 opacity-50"
              />
              <div class="flex flex-col">
                <span
                  :class="[
                    'text-lg text-black dark:text-white',
                    index > currentState && 'opacity-50',
                  ]"
                >
                  {{ step.text }}
                </span>
                <Transition
                  enter-active-class="transition-all duration-300"
                  enter-from-class="opacity-0 -translate-y-1"
                  enter-to-class="opacity-100 translate-y-0"
                >
                  <span
                    v-if="
                      step.afterText &&
                      (index < currentState ||
                        (index === steps.length - 1 &&
                          index === currentState &&
                          isLastStepComplete))
                    "
                    class="mt-1 text-sm text-gray-500 dark:text-gray-400"
                  >
                    {{ step.afterText }}
                  </span>
                </Transition>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        class="absolute inset-x-0 bottom-0 z-[-1] h-full bg-white bg-gradient-to-t [mask-image:radial-gradient(900px_at_center,white_30%,transparent)] dark:bg-black"
      ></div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue';
// 導入預設的自定義圖標
import iconCompletedDefault from '@/assets/images/icon-steploader_checked.svg';
import iconLoadingDefault from '@/assets/images/icon-steploader_loading.svg';
import iconPendingDefault from '@/assets/images/icon-steploader_check.svg';
import iconCloseDefault from '@/assets/images/cancel-icon.svg';

export interface Step {
  text: string; // Display text for the step
  afterText?: string; // Text to show after step completion
  async?: boolean; // If true, waits for external trigger to proceed
  duration?: number; // Duration in ms before proceeding (default: 2000)
  action?: () => void; // Function to execute when step is active
}

interface Props {
  steps: Step[];
  loading?: boolean;
  defaultDuration?: number;
  preventClose?: boolean;
  iconCompleted?: string; // 已完成步驟的圖標（可選，不傳則使用組件內預設）
  iconLoading?: string; // 載入中的圖標（可選，不傳則使用組件內預設）
  iconPending?: string; // 未開始步驟的圖標（可選，不傳則使用組件內預設）
  iconClose?: string; // 關閉按鈕的圖標（可選，不傳則使用組件內預設）
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  defaultDuration: 1500,
  preventClose: false,
  iconCompleted: undefined,
  iconLoading: undefined,
  iconPending: undefined,
  iconClose: undefined
});

// 計算實際使用的圖標：如果 props 有值就用 props，否則用組件內預設的導入圖標
const iconCompletedSrc = computed(() => props.iconCompleted ?? iconCompletedDefault);
const iconLoadingSrc = computed(() => props.iconLoading ?? iconLoadingDefault);
const iconPendingSrc = computed(() => props.iconPending ?? iconPendingDefault);
const iconCloseSrc = computed(() => props.iconClose ?? iconCloseDefault);

const emit = defineEmits<{
  'state-change': [number];
  complete: [];
  close: [];
}>();

const currentState = ref(0);
const stepStartTime = ref(Date.now());
const isLastStepComplete = ref(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentTimer: any = null;

async function executeStepAction(step: Step) {
  if (typeof step.action === 'function') {
    await step.action();
  }
}

async function proceedToNextStep() {
  const currentStep = props.steps[currentState.value];
  if (!currentStep) return;

  // Execute the current step's action
  await executeStepAction(currentStep);

  if (currentState.value < props.steps.length - 1) {
    currentState.value++;
    stepStartTime.value = Date.now();
    emit('state-change', currentState.value);
    processCurrentStep();
  } else {
    isLastStepComplete.value = true;
    emit('complete');
  }
}

async function processCurrentStep() {
  if (currentTimer) {
    clearTimeout(currentTimer);
  }

  const currentStep = props.steps[currentState.value];
  if (!currentStep) return;

  const duration = currentStep.duration || props.defaultDuration;

  if (!currentStep.async) {
    currentTimer = setTimeout(() => {
      proceedToNextStep();
    }, duration);
  }
}

function close() {
  emit('close');
}

// Watch for changes in the async property
watch(
  () => props.steps[currentState.value]?.async,
  async (isAsync, oldIsAsync) => {
    // Only proceed if changing from async to non-async
    if (isAsync === false && oldIsAsync === true) {
      const currentStep = props.steps[currentState.value];
      if (!currentStep) return;

      const duration = currentStep.duration || props.defaultDuration;
      currentTimer = setTimeout(() => {
        proceedToNextStep();
      }, duration);
    }
  }
);

watch(
  () => props.loading,
  (newLoading) => {
    if (newLoading) {
      currentState.value = 0;
      stepStartTime.value = Date.now();
      isLastStepComplete.value = false;
      processCurrentStep();
    } else if (currentTimer) {
      clearTimeout(currentTimer);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (currentTimer) {
    clearTimeout(currentTimer);
  }
});
</script>




