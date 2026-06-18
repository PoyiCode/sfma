<script setup lang="ts">
// 載入佔位塊（§3.3.7 路由邊界 skeleton）。純展示、aria-hidden（載入語意由外層 role=status 提供）；
// 脈動動畫於 prefers-reduced-motion 由 tokens.css 全域降階為靜止。
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

export type SkeletonVariant = 'text' | 'rect' | 'circle';

interface Props {
  variant?: SkeletonVariant;
  width?: string;
  height?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'text',
  width: undefined,
  height: undefined,
});

const style = computed<CSSProperties>(() => {
  const s: CSSProperties = {};
  if (props.width !== undefined) s.width = props.width;
  if (props.height !== undefined) s.height = props.height;
  return s;
});
</script>

<template>
  <span class="skeleton" :data-variant="variant" :style="style" aria-hidden="true" />
</template>

<style scoped>
/* 載入佔位塊（§3.3.7）。脈動以 opacity 變化；reduced-motion 由 tokens.css 全域停用（結束於 opacity:1 可見態）。 */
.skeleton {
  display: block;
  background: var(--color-border);
  border-radius: var(--radius-sm);
  animation: skeletonPulse 1.4s var(--easing-standard) infinite;
}

.skeleton[data-variant='text'] {
  height: 0.85em;
}

.skeleton[data-variant='rect'] {
  border-radius: var(--radius-md);
}

.skeleton[data-variant='circle'] {
  border-radius: var(--radius-full);
}

@keyframes skeletonPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
</style>
