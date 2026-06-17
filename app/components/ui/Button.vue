<script setup lang="ts">
// 領域中性的基礎動作鈕，僅消費 semantic token（03 §3.7.1–3.7.4）。
import type { ButtonHTMLAttributes } from 'vue';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  variant?: ButtonVariant;
  // 預設 type=button（避免於表單內誤觸送出）；可覆寫為 submit/reset。
  type?: ButtonHTMLAttributes['type'];
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  type: 'button',
});
</script>

<template>
  <button :type="type" class="button" :data-variant="variant">
    <slot />
  </button>
</template>

<style scoped>
/* Button：僅取 semantic token；點按目標 ≥ --control-height（03 §3.7.3–3.7.5）。 */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--control-height);
  padding: 0 var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background var(--motion-fast) var(--easing-standard);
}

.button[data-variant='primary'] {
  background: var(--color-accent);
  color: #ffffff;
}

.button[data-variant='primary']:hover {
  background: var(--color-accent-hover);
}

.button[data-variant='secondary'] {
  background: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border);
}

.button[data-variant='ghost'] {
  background: transparent;
  color: var(--color-accent-fg);
}

.button[data-variant='danger'] {
  background: var(--color-danger);
  color: #ffffff;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
