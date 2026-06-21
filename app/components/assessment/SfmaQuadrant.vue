<script setup lang="ts">
// 2×2 判讀方格：FN/FP/DN/DP 四格一鍵選取，對等原本 BaseCheckbox（疼痛）+ BaseSegmentedControl（功能）。
// a11y：radiogroup + 4×radio，旋轉 tabindex，方向鍵左右上下移焦並選取（同 SegmentedControl 模式）。
import { ref } from 'vue';

interface Props {
  painful: boolean;
  dysfunctional: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [{ painful: boolean; dysfunctional: boolean }];
}>();

const { t } = useI18n();

// 格序：FN(0,0) FP(0,1) DN(1,0) DP(1,1)，列主序以配合方向鍵導航。
const cells = [
  { painful: false, dysfunctional: false, code: 'FN' as const },
  { painful: true, dysfunctional: false, code: 'FP' as const },
  { painful: false, dysfunctional: true, code: 'DN' as const },
  { painful: true, dysfunctional: true, code: 'DP' as const },
];

function isSelected(cell: (typeof cells)[number]): boolean {
  return cell.painful === props.painful && cell.dysfunctional === props.dysfunctional;
}

function selectedIndex(): number {
  return cells.findIndex((c) => isSelected(c));
}

const itemRefs = ref<HTMLButtonElement[]>([]);

function selectCell(cell: (typeof cells)[number]): void {
  emit('select', { painful: cell.painful, dysfunctional: cell.dysfunctional });
}

function focusIndex(index: number): void {
  const count = cells.length;
  const next = ((index % count) + count) % count;
  const cell = cells[next];
  if (cell) {
    emit('select', { painful: cell.painful, dysfunctional: cell.dysfunctional });
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
</script>

<template>
  <div class="sfmaQuadrant">
    <!-- 欄標頭（無痛 / 疼痛） -->
    <div class="sfmaQuadrantGrid" role="radiogroup" :aria-label="t('assessmentClassificationGrid')">
      <div class="sfmaQuadrantColHeaders" aria-hidden="true">
        <span class="sfmaQuadrantCorner" />
        <span class="sfmaQuadrantColHead">{{ t('assessmentNonPainful') }}</span>
        <span class="sfmaQuadrantColHead sfmaQuadrantColHeadPain">{{
          t('assessmentPainful')
        }}</span>
      </div>
      <!-- 第一列：功能正常（FN / FP） -->
      <div class="sfmaQuadrantRow">
        <span class="sfmaQuadrantRowHead" aria-hidden="true">{{ t('assessmentFunctional') }}</span>
        <button
          v-for="(cell, idx) in cells.slice(0, 2)"
          :key="cell.code"
          ref="itemRefs"
          type="button"
          class="sfmaQuadrantCell"
          role="radio"
          :data-code="cell.code"
          :data-axis="cell.dysfunctional ? 'dysfunctional' : 'functional'"
          :data-pain="cell.painful"
          :aria-checked="isSelected(cell)"
          :tabindex="isSelected(cell) ? 0 : selectedIndex() === -1 && idx === 0 ? 0 : -1"
          @click="selectCell(cell)"
          @keydown="onKeydown($event, idx)"
        >
          {{ cell.code }}
        </button>
      </div>
      <!-- 第二列：功能異常（DN / DP） -->
      <div class="sfmaQuadrantRow">
        <span class="sfmaQuadrantRowHead" aria-hidden="true">{{
          t('assessmentDysfunctional')
        }}</span>
        <button
          v-for="(cell, idx) in cells.slice(2, 4)"
          :key="cell.code"
          ref="itemRefs"
          type="button"
          class="sfmaQuadrantCell"
          role="radio"
          :data-code="cell.code"
          :data-axis="cell.dysfunctional ? 'dysfunctional' : 'functional'"
          :data-pain="cell.painful"
          :aria-checked="isSelected(cell)"
          :tabindex="isSelected(cell) ? 0 : -1"
          @click="selectCell(cell)"
          @keydown="onKeydown($event, idx + 2)"
        >
          {{ cell.code }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sfmaQuadrant {
  display: inline-block;
}

.sfmaQuadrantGrid {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* 欄標頭列：空角 + 兩欄標頭 */
.sfmaQuadrantColHeaders {
  display: grid;
  grid-template-columns: var(--space-12) 1fr 1fr;
  gap: 0;
}

.sfmaQuadrantCorner {
  display: block;
}

.sfmaQuadrantColHead {
  padding: 0 0 var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: 500;
  text-align: center;
}

.sfmaQuadrantColHeadPain {
  color: var(--color-danger-fg);
}

/* 每列：列標頭 + 兩格 */
.sfmaQuadrantRow {
  display: grid;
  grid-template-columns: var(--space-12) 1fr 1fr;
  gap: 0;
}

.sfmaQuadrantRow + .sfmaQuadrantRow {
  border-top: 1px solid var(--color-border);
}

.sfmaQuadrantRowHead {
  display: flex;
  align-items: center;
  padding-right: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: 500;
  line-height: 1.2;
}

/* 格子 */
.sfmaQuadrantCell {
  appearance: none;
  border: none;
  border-left: 1px solid var(--color-border);
  min-height: var(--control-height);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.03em;
  transition: background var(--motion-fast) var(--easing-standard);
}

/* functional 列：選取時綠色調 */
.sfmaQuadrantCell[data-axis='functional'][aria-checked='true'] {
  background: var(--color-success);
  color: #ffffff;
}

/* dysfunctional 列：選取時紅色調 */
.sfmaQuadrantCell[data-axis='dysfunctional'][aria-checked='true'] {
  background: var(--color-danger);
  color: #ffffff;
}

/* 疼痛欄未選時輕微暖色提示 */
.sfmaQuadrantCell[data-pain='true']:not([aria-checked='true']) {
  color: var(--color-danger-fg);
}

/* focus-visible ring（與全域 :focus-visible 一致；scoped 覆寫強制 outline） */
.sfmaQuadrantCell:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
  z-index: 1;
  position: relative;
}

/* hover 非選取狀態 */
.sfmaQuadrantCell:not([aria-checked='true']):hover {
  background: var(--color-bg);
}
</style>
