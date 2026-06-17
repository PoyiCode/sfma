<script setup lang="ts">
// 唯一帶領域味的 token 綁定元件（03 §3.7.2）：功能軸填色＋疼痛 glyph＋字母恆顯。
// 標籤內嵌 zh-TW 唯一真相（對等 ptApp i18n statusFn/Fp/Dn/Dp）；日後可改接 i18n 但不依賴其先行建置。
import type { PatternClassification } from '@ptapp/shared';
import { computed } from 'vue';

const STATUS_LABEL: Record<PatternClassification, string> = {
  FN: '功能正常、無疼痛',
  FP: '功能正常、但疼痛',
  DN: '功能異常、無疼痛',
  DP: '功能異常、且疼痛',
};

interface Props {
  status: PatternClassification;
}

const props = defineProps<Props>();

const dysfunctional = computed(() => props.status === 'DN' || props.status === 'DP');
const painful = computed(() => props.status === 'FP' || props.status === 'DP');
const label = computed(() => STATUS_LABEL[props.status]);
</script>

<template>
  <span
    class="statusChip"
    :data-status="status"
    :data-axis="dysfunctional ? 'dysfunctional' : 'functional'"
    role="img"
    :aria-label="label"
    :title="label"
  >
    <span class="statusChipCode" aria-hidden="true">{{ status }}</span>
    <span v-if="painful" class="statusChipPain" aria-hidden="true">✳</span>
  </span>
</template>

<style scoped>
/* StatusChip：功能軸填色取 semantic 狀態色，疼痛軸以獨立 glyph 正交呈現（03 §3.7.2）。 */
.statusChip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-width: var(--space-8);
  height: var(--space-6);
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  font-weight: 700;
  line-height: 1;
}

.statusChip[data-axis='functional'] {
  background: var(--color-success);
}

.statusChip[data-axis='dysfunctional'] {
  background: var(--color-danger);
}

.statusChipPain {
  font-size: var(--font-size-xs);
}
</style>
