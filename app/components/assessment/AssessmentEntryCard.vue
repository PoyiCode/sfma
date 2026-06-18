<script setup lang="ts">
// 每側判讀卡＝一筆 PatternRecord（05 §5.2、03 §3.3.9）：受控元件，變更經純函式產生新紀錄上拋（change）。
// 功能軸以 SegmentedControl（二態）呈現（偏離設計「下拉」，見 §3.3.9 實作註）。
import { computed } from 'vue';
import type { PatternRecord } from '@ptapp/shared';
import BaseButton from '../base/Button.vue';
import BaseCheckbox from '../base/Checkbox.vue';
import BaseSegmentedControl from '../base/SegmentedControl.vue';
import BaseStatusChip from '../base/StatusChip.vue';
import {
  entryClassification,
  isManualOverride,
  setDysfunctional,
  setPainful,
  toggleCriterion,
  type AssessmentEntry,
} from '../../utils/assessment/assessmentForm';
import type { BreakoutEntrySummary } from '../../utils/assessment/breakoutPresentation';
import { localizeText } from '../../utils/i18n/localizeText';

interface Props {
  entry: AssessmentEntry;
  record: PatternRecord;
  // 該側判讀為 DN/DP 時顯 Breakout 入口、點按上拋（休眠：未提供則不顯）。
  breakoutEnabled?: boolean;
  // 該側 Breakout 顯示衍生（容器以 breakoutEntrySummary 算好傳入）；undefined＝尚無紀錄。
  breakoutSummary?: BreakoutEntrySummary;
  // 該側有發現（classification≠FN）時「標到模型」深連結（容器帶 session×pattern）；未提供則休眠不顯。§3.3.8。
  modelHref?: string;
}

const props = withDefaults(defineProps<Props>(), {
  breakoutEnabled: false,
  breakoutSummary: undefined,
  modelHref: undefined,
});

const emit = defineEmits<{ change: [record: PatternRecord]; openBreakout: [] }>();

const { t } = useI18n();

const sideLabel = computed(() => {
  if (props.entry.side === 'left') return t('assessmentSideLeft');
  if (props.entry.side === 'right') return t('assessmentSideRight');
  return null;
});

const classification = computed(() => entryClassification(props.record));
// 有發現（非 FN：FP／DN／DP）才提供「標到模型」捷徑；FN 無可標部位。§3.3.8。
const showModelLink = computed(
  () => props.modelHref !== undefined && classification.value !== 'FN',
);
const breakoutStatus = computed(() => props.breakoutSummary?.status ?? 'none');
const showBreakoutEntry = computed(
  () =>
    props.breakoutEnabled &&
    (classification.value === 'DN' ||
      classification.value === 'DP' ||
      breakoutStatus.value !== 'none'),
);
const breakoutButtonLabel = computed(() => {
  if (breakoutStatus.value === 'complete') return t('breakoutEntryReview');
  if (breakoutStatus.value === 'inProgress') return t('breakoutEntryResume');
  return t('breakoutEntry');
});

const functionalValue = computed(() =>
  props.record.dysfunctional ? 'dysfunctional' : 'functional',
);
const functionalOptions = computed(() => [
  { value: 'functional', label: t('assessmentFunctional') },
  { value: 'dysfunctional', label: t('assessmentDysfunctional') },
]);
</script>

<template>
  <div class="assessmentEntryCard">
    <div class="assessmentEntryCardHead">
      <span v-if="sideLabel" class="assessmentEntryCardSide">{{ sideLabel }}</span>
      <BaseStatusChip :status="classification" />
    </div>
    <BaseCheckbox
      :label="t('assessmentPainful')"
      :model-value="record.painful"
      @update:model-value="emit('change', setPainful(record, Boolean($event)))"
    />
    <fieldset class="assessmentEntryCardCriteria">
      <legend>{{ t('assessmentCriteria') }}</legend>
      <BaseCheckbox
        v-for="criterion in entry.definition.criteria"
        :key="criterion.code"
        :label="localizeText(criterion.label)"
        :model-value="record.failedCriteria.includes(criterion.code)"
        @update:model-value="emit('change', toggleCriterion(record, criterion.code))"
      />
    </fieldset>
    <div class="assessmentEntryCardFunction">
      <BaseSegmentedControl
        v-bind="{ ariaLabel: t('assessmentFunctionalAxis') }"
        :model-value="functionalValue"
        :options="functionalOptions"
        @update:model-value="emit('change', setDysfunctional(record, $event === 'dysfunctional'))"
      />
      <span v-if="isManualOverride(record)" class="assessmentEntryCardManual">
        {{ t('assessmentManualOverride') }}
      </span>
    </div>
    <div v-if="showBreakoutEntry" class="assessmentEntryCardBreakout">
      <BaseButton variant="secondary" @click="emit('openBreakout')">
        {{ breakoutButtonLabel }}
      </BaseButton>
      <span v-if="breakoutSummary?.status === 'complete'" class="assessmentEntryCardBreakoutTypes">
        <span
          v-for="type in breakoutSummary.findingTypes"
          :key="type"
          class="assessmentEntryCardFindingType"
          :data-pain="type === 'PAIN'"
          :data-classification="type === breakoutSummary.classification"
          :aria-label="
            type === breakoutSummary.classification
              ? `${t('breakoutClassificationLabel')}：${type}`
              : undefined
          "
        >
          {{ type }}
        </span>
      </span>
      <span v-else class="assessmentEntryCardBreakoutHint">
        {{ classification === 'DN' ? t('breakoutEntryPriority') : t('breakoutEntryPainDependent') }}
      </span>
    </div>
    <NuxtLink v-if="showModelLink" class="button" data-variant="ghost" :to="modelHref">
      {{ t('markOnModel') }}
    </NuxtLink>
  </div>
</template>

<style scoped>
.assessmentEntryCard {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
}

.assessmentEntryCardHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.assessmentEntryCardSide {
  font-weight: 600;
}

.assessmentEntryCardCriteria {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-2) 0 0;
  border: none;
}

.assessmentEntryCardCriteria legend {
  padding: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.assessmentEntryCardFunction {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.assessmentEntryCardManual {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.assessmentEntryCardBreakout {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.assessmentEntryCardBreakoutHint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.assessmentEntryCardBreakoutTypes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.assessmentEntryCardFindingType {
  flex: none;
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--clinical-finding);
  color: #ffffff;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.assessmentEntryCardFindingType[data-pain='true'] {
  background: var(--color-danger);
}

/* classification 那枚以外框強調，與概況其餘 chip 區別（設計同步：概況與 classification 合並單組） */
.assessmentEntryCardFindingType[data-classification='true'] {
  box-shadow:
    0 0 0 2px var(--color-bg),
    0 0 0 3px currentColor;
}
</style>
