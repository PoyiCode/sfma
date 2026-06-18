<script setup lang="ts">
// icon-only 鈕：label 強制提供無障礙名稱（aria-label＋title），icon 以 aria-hidden 呈現（03 §3.7.5）。
// icon 可由 props.icon（字串符號）或 default slot 提供。
import type { ButtonHTMLAttributes } from 'vue';

interface Props {
  label: string;
  icon?: string;
  type?: ButtonHTMLAttributes['type'];
}

withDefaults(defineProps<Props>(), {
  icon: undefined,
  type: 'button',
});
</script>

<template>
  <button :type="type" class="iconButton" :aria-label="label" :title="label">
    <span class="iconButtonGlyph" aria-hidden="true">
      <slot>{{ icon }}</slot>
    </span>
  </button>
</template>

<style scoped>
/* IconButton：方形點按目標 ≥ --target-min，僅取 semantic token（03 §3.7.3–3.7.5）。 */
.iconButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--target-min);
  height: var(--target-min);
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background var(--motion-fast) var(--easing-standard);
}

.iconButton:hover {
  background: color-mix(in srgb, currentColor 12%, transparent);
}

.iconButton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.iconButtonGlyph {
  font-size: var(--font-size-xl);
  line-height: 1;
}
</style>
