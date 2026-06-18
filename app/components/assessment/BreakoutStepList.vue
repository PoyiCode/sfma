<script setup lang="ts">
// 步驟清單純展示（03 §3.3.9 line 171）：序·測試名·結果碼·該步衍生 findingType chip；
// 當前待測步以 data-current／aria-current 高亮並顯「目前」。提供 rewindStep listener 時已答步顯 ✎ 改步入口；
// 上拋 0-based 步索引。破壞性作廢的量化確認由上層（疊層）以 AlertDialog 把關。
import BaseIconButton from '../base/IconButton.vue';
import type { BreakoutStepView } from '../../utils/assessment/breakoutPresentation';
import { localizeText } from '../../utils/i18n/localizeText';

interface Props {
  steps: BreakoutStepView[];
  // 提供時於每筆已答步（非當前步）渲染 ✎「從此步重走」鈕。
  rewindable?: boolean;
}

withDefaults(defineProps<Props>(), { rewindable: false });

const emit = defineEmits<{ rewindStep: [stepIndex: number] }>();

const { t } = useI18n();
</script>

<template>
  <ol class="breakoutStepList" :aria-label="t('breakoutStepListLabel')">
    <li
      v-for="step in steps"
      :key="`${step.flowKey}:${step.nodeKey}:${step.index}`"
      class="breakoutStepRow"
      :data-current="step.isCurrent"
      :aria-current="step.isCurrent ? 'step' : undefined"
    >
      <span class="breakoutStepIndex">{{ step.index }}</span>
      <span class="breakoutStepName">
        {{ step.testName !== undefined ? localizeText(step.testName) : step.nodeKey }}
      </span>
      <span v-if="step.result !== undefined" class="breakoutStepResult">{{ step.result }}</span>
      <span v-else class="breakoutStepResult breakoutStepResultCurrent">
        {{ t('breakoutStepCurrent') }}
      </span>
      <span v-if="step.findingTypes.length > 0" class="breakoutStepFindings">
        <span
          v-for="type in step.findingTypes"
          :key="type"
          class="breakoutStepFindingChip"
          :data-pain="type === 'PAIN'"
        >
          {{ type }}
        </span>
      </span>
      <BaseIconButton
        v-if="rewindable && !step.isCurrent"
        class="breakoutStepRewind"
        :label="t('breakoutStepRewind')"
        icon="✎"
        @click="emit('rewindStep', step.index - 1)"
      />
    </li>
  </ol>
</template>

<style scoped>
/* 步驟清單（03 §3.3.9 line 171）：序·測試名·結果碼·finding chip；當前步高亮。 */
.breakoutStepList {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.breakoutStepRow {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.breakoutStepRow[data-current='true'] {
  background: var(--color-surface);
  box-shadow: inset 2px 0 0 var(--color-accent);
}

.breakoutStepIndex {
  flex: none;
  min-width: 1.5em;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: right;
}

.breakoutStepName {
  flex: 1 1 auto;
}

.breakoutStepResult {
  flex: none;
  font-weight: 700;
  font-size: var(--font-size-sm);
}

.breakoutStepResultCurrent {
  color: var(--color-text-muted);
  font-weight: 400;
}

.breakoutStepFindings {
  display: flex;
  flex: none;
  gap: var(--space-1);
}

.breakoutStepFindingChip {
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--clinical-finding);
  color: #ffffff;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.breakoutStepFindingChip[data-pain='true'] {
  background: var(--color-danger);
}

.breakoutStepRewind {
  flex: none;
}
</style>
