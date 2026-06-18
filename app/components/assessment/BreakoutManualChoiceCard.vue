<script setup lang="ts">
// 人工擇一候選卡（05 §5.3.3 #7／03 §3.3.9 line 167）：priorResult 缺值致分支 undecidable 時，
// 列各候選分支供臨床判斷擇一。純展示——擇一／取消經回呼上拋（引導與自由模式共用）。
import BaseButton from '../base/Button.vue';
import type { BreakoutCandidateView } from '../../utils/assessment/breakoutPresentation';
import { localizeText } from '../../utils/i18n/localizeText';

interface Props {
  candidates: BreakoutCandidateView[];
}

defineProps<Props>();

const emit = defineEmits<{ choose: [branchIndex: number]; cancel: [] }>();

const { t } = useI18n();
</script>

<template>
  <section class="breakoutManualChoice" :aria-label="t('breakoutManualChoiceTitle')">
    <h3 class="breakoutManualChoiceTitle">{{ t('breakoutManualChoiceTitle') }}</h3>
    <p class="breakoutManualChoicePrompt">{{ t('breakoutManualChoicePrompt') }}</p>
    <ul class="breakoutManualChoiceList">
      <li v-for="candidate in candidates" :key="candidate.branchIndex">
        <BaseButton
          variant="secondary"
          class="breakoutManualChoiceOption"
          @click="emit('choose', candidate.branchIndex)"
        >
          <span v-if="candidate.prior !== undefined" class="breakoutManualChoicePrior">
            {{
              `${t('breakoutManualChoicePrior')} ${localizeText(candidate.prior.testName)}：${candidate.prior.resultCodes.join('／')}`
            }}
          </span>
          <span class="breakoutManualChoiceOutcome">
            <span
              v-for="(type, index) in candidate.findingTypes"
              :key="`${type}-${index}`"
              class="breakoutManualChoiceChip"
              :data-pain="type === 'PAIN'"
            >
              {{ type }}
            </span>
            <span v-for="(label, index) in candidate.outcomeLabels" :key="index">
              {{ localizeText(label) }}
            </span>
          </span>
        </BaseButton>
      </li>
    </ul>
    <BaseButton variant="ghost" class="breakoutManualChoiceCancel" @click="emit('cancel')">
      {{ t('breakoutManualChoiceCancel') }}
    </BaseButton>
  </section>
</template>

<style scoped>
/* 人工擇一候選卡（03 §3.3.9）：標題＋提示＋候選按鈕清單（堆疊）＋取消。 */
.breakoutManualChoice {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.breakoutManualChoiceTitle {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
}

.breakoutManualChoicePrompt {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.breakoutManualChoiceList {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 候選按鈕：上 priorResult 依據、下結局概況，左對齊多行。 */
.breakoutManualChoiceOption {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  width: 100%;
  text-align: left;
}

.breakoutManualChoicePrior {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.breakoutManualChoiceOutcome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.breakoutManualChoiceChip {
  flex: none;
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--clinical-finding);
  color: #ffffff;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.breakoutManualChoiceChip[data-pain='true'] {
  background: var(--color-danger);
}

.breakoutManualChoiceCancel {
  align-self: flex-start;
}
</style>
