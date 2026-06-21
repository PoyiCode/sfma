<script setup lang="ts">
// enum 偏好控制項（03 §3.7.4）：以 radiogroup 角色＋semantic token 自建（對等原 Radix RadioGroup）。
// 鍵盤：方向鍵於選項間移動焦點並選取（roving tabindex），符合 WAI-ARIA radiogroup 模式。
import { ref, watch } from 'vue';

export interface SegmentedOption {
  value: string;
  label: string;
}

interface Props {
  options: SegmentedOption[];
  ariaLabel: string;
}

const props = defineProps<Props>();
const model = defineModel<string>({ required: true });

const itemRefs = ref<HTMLButtonElement[]>([]);

function select(value: string): void {
  model.value = value;
}

function focusIndex(index: number): void {
  const count = props.options.length;
  const next = ((index % count) + count) % count;
  const option = props.options[next];
  if (option) {
    model.value = option.value;
    itemRefs.value[next]?.focus();
  }
}

function onKeydown(event: KeyboardEvent, index: number): void {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    focusIndex(index + 1);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    focusIndex(index - 1);
  }
}

watch(
  () => props.options,
  () => {
    itemRefs.value = [];
  },
);
</script>

<template>
  <div class="segmented" role="radiogroup" :aria-label="ariaLabel">
    <button
      v-for="(option, index) in options"
      :key="option.value"
      ref="itemRefs"
      type="button"
      class="segmentedItem"
      role="radio"
      :aria-checked="model === option.value"
      :data-state="model === option.value ? 'checked' : 'unchecked'"
      :tabindex="model === option.value ? 0 : -1"
      @click="select(option.value)"
      @keydown="onKeydown($event, index)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
/* 分段選擇器；顏色取 semantic token（03 §3.7）。 */
.segmented {
  display: inline-flex;
  gap: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.segmentedItem {
  appearance: none;
  border: none;
  border-left: 1px solid var(--color-border);
  min-height: var(--control-height);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  cursor: pointer;
}

.segmentedItem:first-child {
  border-left: none;
}

.segmentedItem[data-state='checked'] {
  background: var(--color-accent);
  color: #ffffff;
}

/* `:focus-visible` 強化：父層 overflow:hidden 會截斷 outline；
   改用 box-shadow 模擬外框（不受裁切），並疊背景色變化增強對比。
   prefers-reduced-motion 不影響靜態 box-shadow／background（僅 transition 受全域 reduce）。 */
.segmentedItem:focus-visible {
  outline: none; /* 由 box-shadow 取代，避免被 overflow:hidden 截斷 */
  box-shadow: inset 0 0 0 2px var(--color-focus);
  background: color-mix(in srgb, var(--color-focus) 12%, var(--color-surface));
  z-index: 1;
  position: relative;
}

.segmentedItem[data-state='checked']:focus-visible {
  box-shadow:
    inset 0 0 0 2px var(--color-focus),
    inset 0 0 0 4px var(--color-accent);
  background: var(--color-accent);
}
</style>
