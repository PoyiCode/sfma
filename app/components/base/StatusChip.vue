<script setup lang="ts">
// 唯一帶領域味的 token 綁定元件（03 §3.7.2）＝APP 的「簽名」標記（§3.7.4）：
// 把 SFMA 判讀的 2×2 心智模型（功能軸 × 疼痛軸）直接畫成微縮方格——亮起的格「位置即答案」，
// 與全尺寸輸入元件 SfmaQuadrant 同構（同列＝功能/異常、同欄＝無痛/疼痛），先讀「形」再讀「字」。
// 編碼仍遵 §3.7.2：功能軸填色（functional 綠／dysfunctional 紅）＋疼痛軸獨立 glyph（✳）＋字母恆顯。
// 標籤內嵌 zh-TW 唯一真相（對等 ptApp i18n statusFn/Fp/Dn/Dp）。
import type { PatternClassification } from '@ptapp/shared';
import { computed } from 'vue';

const STATUS_LABEL: Record<PatternClassification, string> = {
  FN: '功能正常、無疼痛',
  FP: '功能正常、但疼痛',
  DN: '功能異常、無疼痛',
  DP: '功能異常、且疼痛',
};

// 格序對齊 SfmaQuadrant：列＝功能(0)/異常(1)，欄＝無痛(0)/疼痛(1)；row-major FN,FP,DN,DP。
const CELLS: ReadonlyArray<PatternClassification> = ['FN', 'FP', 'DN', 'DP'];

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
    <span class="statusChipMark" aria-hidden="true">
      <span
        v-for="cell in CELLS"
        :key="cell"
        class="statusChipCell"
        :data-active="cell === status"
        :data-axis="cell === 'DN' || cell === 'DP' ? 'dysfunctional' : 'functional'"
      />
    </span>
    <span class="statusChipCode" aria-hidden="true">{{ status }}</span>
    <span v-if="painful" class="statusChipPain" aria-hidden="true">✳</span>
  </span>
</template>

<style scoped>
/* Quadrant Mark：微縮 2×2＋mono 代碼＋疼痛 glyph（03 §3.7.2、§3.7.4）。 */
.statusChip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-mono);
  line-height: 1;
}

/* 2×2 標記：hairline 格線（以 gap 透出底色）＋四格；亮格依軸填臨床色。 */
.statusChipMark {
  display: grid;
  grid-template-columns: repeat(2, 8px);
  grid-template-rows: repeat(2, 8px);
  gap: 1px;
  padding: 1px;
  border-radius: 3px;
  background: var(--color-border);
}

.statusChipCell {
  border-radius: 1px;
  background: var(--color-surface);
}

/* 亮格：功能列綠、異常列紅（與 SfmaQuadrant 一致；二元、色盲安全） */
.statusChipCell[data-active='true'][data-axis='functional'] {
  background: var(--color-success);
}

.statusChipCell[data-active='true'][data-axis='dysfunctional'] {
  background: var(--color-danger);
}

.statusChipCode {
  font-size: var(--font-size-sm);
  font-weight: 700;
  letter-spacing: var(--tracking-data);
  color: var(--color-text);
}

/* 疼痛 glyph（疼痛軸獨立呈現、不僅依顏色／位置；§3.6 無障礙）。 */
.statusChipPain {
  align-self: flex-start;
  margin-left: -1px;
  font-size: var(--font-size-xs);
  color: var(--color-danger-fg);
}
</style>
