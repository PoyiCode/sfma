<script setup lang="ts">
// 一般用途 Vue 錯誤邊界（對等 ptApp class 元件 ErrorBoundary，02 §2.5 後備）：
// 子樹 render 或非同步元件載入／執行期拋錯時，改渲 fallback slot 而非整頁崩潰。
import { onErrorCaptured, ref } from 'vue';

const emit = defineEmits<{ error: [error: Error] }>();

const hasError = ref(false);

onErrorCaptured((error) => {
  hasError.value = true;
  emit('error', error instanceof Error ? error : new Error(String(error)));
  // 回傳 false：阻止錯誤繼續向上傳播（已由本邊界處理），避免整頁崩潰。
  return false;
});
</script>

<template>
  <slot v-if="hasError" name="fallback" />
  <slot v-else />
</template>
