<script setup lang="ts">
// 領域中性下拉：包裝 Nuxt UI USelect（行為／無障礙由其底層 Reka UI 提供），外觀由 app.config 主色貼近設計。
// 對外維持原元件 API：options（{value,label}）、v-model、ariaLabel（供日後模組沿用，03 §3.7.4）。
export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  options: SelectOption[];
  ariaLabel: string;
  disabled?: boolean;
  placeholder?: string;
}

defineProps<Props>();

const model = defineModel<string>();
</script>

<template>
  <USelect
    v-model="model"
    :items="options"
    value-key="value"
    label-key="label"
    :disabled="disabled"
    :placeholder="placeholder"
    :aria-label="ariaLabel"
    class="w-full"
  />
</template>
