<script setup lang="ts">
// 提示橫幅（§3.7.4 Callout；§3.3.3 暫態層）。領域中性、純展示：role=status 非阻擋宣告，
// 左色條依 tone 取臨床／語意 token。自建（比照 StatusChip）。
import UiButton from './Button.vue';

export type CalloutTone = 'info' | 'warning' | 'success' | 'danger';

interface Props {
  tone?: CalloutTone;
  title?: string;
  // 選填：提供 onDismiss＝顯關閉鈕（休眠慣例）；dismissLabel 為其無障礙名。
  dismissLabel?: string;
}

withDefaults(defineProps<Props>(), {
  tone: 'info',
  title: undefined,
  dismissLabel: undefined,
});

const emit = defineEmits<{ dismiss: [] }>();
</script>

<template>
  <aside class="callout" role="status" :data-tone="tone">
    <div class="calloutBody">
      <p v-if="title !== undefined" class="calloutTitle">{{ title }}</p>
      <div class="calloutContent"><slot /></div>
    </div>
    <UiButton
      v-if="dismissLabel !== undefined"
      variant="ghost"
      :aria-label="dismissLabel"
      @click="emit('dismiss')"
    >
      {{ dismissLabel }}
    </UiButton>
  </aside>
</template>

<style scoped>
.callout {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-accent);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.callout[data-tone='warning'] {
  border-left-color: var(--color-warning);
}

.callout[data-tone='success'] {
  border-left-color: var(--color-success);
}

.callout[data-tone='danger'] {
  border-left-color: var(--color-danger);
}

.calloutBody {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.calloutTitle {
  margin: 0;
  font-weight: 600;
  color: var(--color-text);
}

.calloutContent {
  color: var(--color-text-muted);
}
</style>
