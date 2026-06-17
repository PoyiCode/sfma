<script setup lang="ts">
// 路由邊界／資料層錯誤畫面（03 §3.3.7「資料層錯誤＋重試」）。
// 無障礙：role=alert 使錯誤訊息於出現時即被輔助技術宣讀（WCAG 2.1 §4.1.3 Status Messages）。
import UiButton from './Button.vue';

interface Props {
  // SR 宣讀之錯誤訊息（呼叫端傳 t('…Error')，保持原件 i18n 中性）。
  message: string;
  // 重試鈕文字（呼叫端傳 t('retry')）；與 onRetry（retry emit）皆備才渲染重試鈕。
  retryLabel?: string;
}

withDefaults(defineProps<Props>(), {
  retryLabel: undefined,
});

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="pageError" role="alert">
    <p class="pageErrorMessage">{{ message }}</p>
    <UiButton v-if="retryLabel !== undefined" @click="emit('retry')">{{ retryLabel }}</UiButton>
  </div>
</template>

<style scoped>
/* 路由邊界／資料層錯誤區（§3.3.7）。各頁可另以透傳 class 微調版面。 */
.pageError {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}

.pageErrorMessage {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
