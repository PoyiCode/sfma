<script setup lang="ts">
// Breakout 步進卡（03 §3.3.9）：純展示——測試名·主被動 badge·判準·結果鈕（核心 4 碼＋特殊碼 chip）。
// 點按上拋結果碼，引擎前進由上層（疊層）負責。
import { computed } from 'vue';
import type { BreakoutNode } from '@ptapp/shared';
import UiButton from '../base/Button.vue';
import { localizeText } from '../../utils/i18n/localizeText';

interface Props {
  node: BreakoutNode;
  // 不分側測試（sideIndependent）另一側已測之前值；存在時顯「沿用前值」鈕（05 §5.3.3 #8）。
  priorResult?: string;
}

const props = withDefaults(defineProps<Props>(), { priorResult: undefined });

const emit = defineEmits<{ result: [result: string] }>();

const { t } = useI18n();

// 核心 4 碼固定順序（03 §3.3.9）；title 取 statusFn/Fp/Dp/Dn 意義（與 StatusChip 同語意）。
const CORE_RESULTS: readonly string[] = ['FN', 'FP', 'DP', 'DN'];
const CORE_RESULT_TITLE: Record<string, string> = {
  FN: 'statusFn',
  FP: 'statusFp',
  DP: 'statusDp',
  DN: 'statusDn',
};

// 特殊選項碼 → 本地化標籤鍵（05 §5.3.2；資料僅存碼）。未對照者退回原碼。
const SPECIAL_RESULT_LABEL: Record<string, string | undefined> = {
  dysfunctional: 'breakoutResultDysfunctional',
  fnBilateral: 'breakoutResultFnBilateral',
  fnKneeStraight: 'breakoutResultFnKneeStraight',
  fnHipAbducted: 'breakoutResultFnHipAbducted',
  fnHipAbductedKneeStraight: 'breakoutResultFnHipAbductedKneeStraight',
  shoulderFlexionImproves: 'breakoutResultShoulderFlexionImproves',
  switchesSides: 'breakoutResultSwitchesSides',
};

function specialResultLabel(code: string): string {
  const key = SPECIAL_RESULT_LABEL[code];
  return key === undefined ? code : t(key);
}

const coreResults = computed(() =>
  CORE_RESULTS.filter((code) => props.node.resultOptions.includes(code)),
);
const specialResults = computed(() =>
  props.node.resultOptions.filter((code) => !CORE_RESULTS.includes(code)),
);
const nodeName = computed(() => localizeText(props.node.name));
const criterion = computed(() =>
  props.node.criterion ? localizeText(props.node.criterion) : undefined,
);
const priorLabel = computed(() =>
  props.priorResult !== undefined ? specialResultLabel(props.priorResult) : '',
);
</script>

<template>
  <div class="breakoutStepCard">
    <div class="breakoutStepCardHead">
      <span class="breakoutStepCardMode" :data-mode="node.mode">
        {{ t(node.mode === 'active' ? 'breakoutModeActive' : 'breakoutModePassive') }}
      </span>
      <h3 class="breakoutStepCardName">{{ nodeName }}</h3>
    </div>
    <p v-if="criterion" class="breakoutStepCardCriterion">{{ criterion }}</p>
    <div v-if="priorResult !== undefined" class="breakoutStepCardPrior">
      <span class="breakoutStepCardPriorLabel">{{ t('breakoutPriorOtherSide') }}</span>
      <UiButton variant="secondary" @click="emit('result', priorResult)">
        {{ `${t('breakoutUsePriorValue')}（${priorLabel}）` }}
      </UiButton>
    </div>
    <div class="breakoutStepCardCore">
      <UiButton
        v-for="code in coreResults"
        :key="code"
        variant="secondary"
        :title="t(CORE_RESULT_TITLE[code] ?? code)"
        @click="emit('result', code)"
      >
        {{ code }}
      </UiButton>
    </div>
    <div v-if="specialResults.length > 0" class="breakoutStepCardSpecial">
      <UiButton
        v-for="code in specialResults"
        :key="code"
        variant="ghost"
        @click="emit('result', code)"
      >
        {{ specialResultLabel(code) }}
      </UiButton>
    </div>
  </div>
</template>

<style scoped>
/* Breakout 步進卡（03 §3.3.9、§3.7）。 */
.breakoutStepCard {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.breakoutStepCardHead {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.breakoutStepCardMode {
  flex: none;
  padding: 0 var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.breakoutStepCardName {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.breakoutStepCardCriterion {
  margin: 0;
  color: var(--color-text-muted);
}

/* 不分側測試另一側前值（05 §5.3.3 #8）：虛線框提示＋「沿用前值」鈕。 */
.breakoutStepCardPrior {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.breakoutStepCardPriorLabel {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.breakoutStepCardCore {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.breakoutStepCardSpecial {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
