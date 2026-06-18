<script setup lang="ts">
// 破壞性確認對話框：包裝 Nuxt UI UModal 為確認型（行為由底層 Reka UI Dialog 提供）。
// 受控（v-model:open）、領域中性——標題／說明／鈕字由 props 傳入。Action 點按發 confirm 並關閉；Cancel 僅關閉。
// 對外維持原元件 API（cancelLabel/actionLabel/confirm/destructive）供日後模組沿用（03 §3.7.4）。
import UiButton from './Button.vue';

const open = defineModel<boolean>('open', { required: true });

interface Props {
  title: string;
  description?: string;
  cancelLabel: string;
  actionLabel: string;
  // 確認為破壞性動作時，確認鈕用 danger variant、標題加強調色（03 §3.3.9）。
  destructive?: boolean;
}

withDefaults(defineProps<Props>(), {
  description: undefined,
  destructive: false,
});

const emit = defineEmits<{ confirm: [] }>();

function cancel(): void {
  open.value = false;
}

function confirm(): void {
  emit('confirm');
  open.value = false;
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="description"
    :close="false"
    :dismissible="false"
    :data-destructive="destructive"
    :ui="{ title: destructive ? 'ui-alert-title-destructive' : undefined }"
  >
    <template #footer>
      <div class="alertDialogActions">
        <UiButton variant="secondary" @click="cancel">{{ cancelLabel }}</UiButton>
        <UiButton :variant="destructive ? 'danger' : 'primary'" @click="confirm">
          {{ actionLabel }}
        </UiButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.alertDialogActions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  width: 100%;
}
</style>
