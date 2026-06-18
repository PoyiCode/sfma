<script setup lang="ts">
// 領域中性基礎輸入，僅消費 semantic token（03 §3.7.4）。v-model 雙向綁定；其餘原生屬性透傳。
import type { InputHTMLAttributes } from 'vue';

interface Props {
  type?: InputHTMLAttributes['type'];
}

withDefaults(defineProps<Props>(), {
  type: 'text',
});

const model = defineModel<string | number>();
</script>

<template>
  <input
    :type="type"
    class="input"
    :value="model"
    @input="model = ($event.target as HTMLInputElement).value"
  />
</template>

<style scoped>
/* Input：僅取 semantic token；高度 ≥ --control-height（03 §3.7.3–3.7.5）。 */
.input {
  display: block;
  width: 100%;
  min-height: var(--control-height);
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
}

.input::placeholder {
  color: var(--color-text-muted);
}

/* 失效態：紅框標示（前景安全色、暗色亦達對比）；與下方錯誤文字＋aria-invalid 並存，
   不僅依賴顏色（§3.6／§3.7.5）。可重用於任何受驗證輸入。 */
.input[aria-invalid='true'] {
  border-color: var(--color-danger-fg);
}
</style>
