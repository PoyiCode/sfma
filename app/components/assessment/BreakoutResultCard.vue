<script setup lang="ts">
// Breakout 端點結果卡（03 §3.3.9）：純展示——左色條四型＋眉標題＋內容。
// PAIN 以 ⚠ 圖示＋文字並呈（不僅靠顏色，§3.6）；finding 顯 findingType 徽章。
// model 型別已下放至 breakoutPresentation（utils），自該處 import。
import { computed } from 'vue';
import type { BreakoutResultCardModel } from '../../utils/assessment/breakoutPresentation';
import { localizeText } from '../../utils/i18n/localizeText';

interface Props {
  model: BreakoutResultCardModel;
}

const props = defineProps<Props>();

const { t } = useI18n();

type ResultTone = 'finding' | 'pain' | 'goToFlow' | 'neutral';

// 型別→色調（03 §3.3.9）：finding 依 PAIN 分紅／橙。
const tone = computed<ResultTone>(() => {
  const model = props.model;
  if (model.kind === 'finding') return model.findingType === 'PAIN' ? 'pain' : 'finding';
  if (model.kind === 'goToFlow') return 'goToFlow';
  return 'neutral';
});

const isPain = computed(() => props.model.kind === 'finding' && props.model.findingType === 'PAIN');
const isFinding = computed(
  () => props.model.kind === 'finding' && props.model.findingType !== 'PAIN',
);
const findingBadge = computed(() =>
  props.model.kind === 'finding' ? props.model.findingType : undefined,
);

const eyebrow = computed(() => {
  const model = props.model;
  switch (model.kind) {
    case 'finding':
      return model.findingType === 'PAIN'
        ? t('breakoutEndpointPainTitle')
        : t('breakoutEndpointFinding');
    case 'goToFlow':
      return t('breakoutEndpointGoToFlowTitle');
    case 'instruction':
      return t('breakoutEndpointInstructionTitle');
    case 'next':
      return t('breakoutEndpointNextTitle');
  }
  return '';
});

const body = computed(() => {
  const model = props.model;
  switch (model.kind) {
    case 'finding':
      return localizeText(model.label);
    case 'goToFlow':
      return localizeText(model.flowName);
    case 'instruction':
      return localizeText(model.label);
    case 'next':
      return localizeText(model.nextName);
  }
  return '';
});
</script>

<template>
  <div class="breakoutResultCard" :data-tone="tone">
    <p class="breakoutResultCardEyebrow">
      <span v-if="isPain" class="breakoutResultCardIcon" aria-hidden="true">⚠</span>
      <span v-if="isFinding" class="breakoutResultCardBadge">{{ findingBadge }}</span>
      {{ eyebrow }}
    </p>
    <p class="breakoutResultCardBody">{{ body }}</p>
  </div>
</template>

<style scoped>
/* Breakout 端點結果卡四型（03 §3.3.9、§3.7.2）；左色條依 data-tone。 */
.breakoutResultCard {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-left-width: var(--space-1);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.breakoutResultCard[data-tone='finding'] {
  border-left-color: var(--clinical-finding);
}

.breakoutResultCard[data-tone='pain'] {
  border-left-color: var(--color-danger);
}

.breakoutResultCard[data-tone='goToFlow'] {
  border-left-color: var(--color-accent);
}

.breakoutResultCard[data-tone='neutral'] {
  border-left-color: var(--color-text-muted);
}

.breakoutResultCardEyebrow {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.breakoutResultCard[data-tone='pain'] .breakoutResultCardEyebrow {
  color: var(--color-danger-fg);
  font-weight: 700;
}

.breakoutResultCardIcon {
  color: var(--color-danger-fg);
}

.breakoutResultCardBadge {
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--clinical-finding);
  color: #ffffff;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.breakoutResultCardBody {
  margin: 0;
  color: var(--color-text);
}
</style>
