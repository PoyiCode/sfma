<script setup lang="ts">
// 手風琴：包裝 Nuxt UI UAccordion（行為由底層 Reka UI Accordion 提供——鍵盤、aria、展開動畫）。
// 預設 type="multiple"（評估表可同時展開多列填寫）；type="single" 則 collapsible（可全收合）。
// 對外維持原元件 API（items: {value, trigger, content}）；trigger→label、content→以同名具名 slot 渲染，
// 使呼叫端可放置任意富內容（對等 ptApp ReactNode），亦支援純字串 content（03 §3.7.4）。
// 富列頭（trigger）以 #trigger-<value> 具名 slot 注入（如評估表列頭含 StatusChip 概況），無提供則退回字串 trigger。
import { computed, useSlots } from 'vue';

const slots = useSlots();

export interface AccordionItemData {
  value: string;
  trigger: string;
  content?: string;
}

interface Props {
  items: AccordionItemData[];
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
}

const props = withDefaults(defineProps<Props>(), {
  type: 'multiple',
  defaultValue: undefined,
});

// 映射為 UAccordion items：label＝trigger、slot＝value（供同名具名 slot 注入富內容）。
const uiItems = computed(() =>
  props.items.map((item) => ({
    label: item.trigger,
    value: item.value,
    content: item.content,
    slot: item.value,
  })),
);
</script>

<template>
  <UAccordion
    :items="uiItems"
    :type="type"
    :collapsible="type === 'single'"
    :default-value="defaultValue"
    class="accordion"
  >
    <template #default="{ item }">
      <slot v-if="slots[`trigger-${item.value}`]" :name="`trigger-${item.value}`" :item="item" />
      <template v-else>{{ item.label }}</template>
    </template>
    <template v-for="item in items" #[`${item.value}`] :key="item.value">
      <slot :name="item.value">{{ item.content }}</slot>
    </template>
  </UAccordion>
</template>

<style scoped>
.accordion {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* `:focus-visible` 強化：Nuxt UI／Reka UI 的 AccordionTrigger 可能以 outline:none 覆蓋全域規則。
   以 :deep() 穿透 Shadow DOM 邊界並明確宣告 tokens，確保觸發按鈕的焦點環在任何主題下均清晰可見。
   使用 var(--color-focus)（= teal-600 light / teal-400 dark）符合 §3.7.5 設計規範。 */
.accordion :deep([data-slot='trigger']:focus-visible) {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
  background: color-mix(in srgb, var(--color-focus) 8%, transparent);
}
</style>
