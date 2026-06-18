<script setup lang="ts">
// 基礎開關：包裝 Nuxt UI USwitch（行為由底層 Reka UI 提供——role=switch、鍵盤、label 關聯）。
// 對外維持原元件 API（label/v-model/disabled）供日後模組沿用（03 §3.7.4）。
const model = defineModel<boolean>();

interface Props {
  label: string;
  disabled?: boolean;
  id?: string;
}

defineProps<Props>();
</script>

<template>
  <USwitch :id="id" v-model="model" :label="label" :disabled="disabled" color="primary" />
</template>
