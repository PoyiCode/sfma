<script setup lang="ts">
// 一般用途對話框：包裝 Nuxt UI UModal（行為由其底層 Reka UI Dialog 提供——焦點陷阱、Esc 關閉、Portal、scrim）。
// 受控（v-model:open）、領域中性——標題／說明由 props 傳入，主體由 default slot 組合（03 §3.7.4）。
// 對外維持原元件 API（open/title/description/closeLabel）供日後模組沿用。
import { computed } from 'vue';
import type { ButtonProps } from '@nuxt/ui';

const open = defineModel<boolean>('open', { required: true });

interface Props {
  title: string;
  description?: string;
  // × 關閉鈕之無障礙名稱（icon-only，03 §3.7.5）。
  closeLabel: string;
}

const props = defineProps<Props>();

// UModal 之 close 接受 ButtonProps；aria-label 為原生屬性（不在型別介面內，故以 ButtonProps 物件附帶）。
const closeButton = computed<ButtonProps>(
  () => ({ 'aria-label': props.closeLabel }) as ButtonProps,
);
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description" :close="closeButton">
    <template #body>
      <div class="dialogBody">
        <slot />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.dialogBody {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  color: var(--color-text);
}
</style>
