<script setup lang="ts">
// Breakout 完成卡（03 §3.3.9 line 175；05 §5.3.4）：流程走完於疊層中段顯——完成標題＋判讀（覆寫下拉，
// 顯「已手動」別於自動）＋本次 findings[] 摘要。純展示：覆寫經 classificationChange 上拋落盤。
import { computed } from 'vue';
import { breakoutFindingTypeSchema, type BreakoutFindingType } from '@ptapp/shared';
import UiSelect, { type SelectOption } from '../ui/Select.vue';
import type { BreakoutFindingView } from '../../utils/assessment/breakoutPresentation';
import { localizeText } from '../../utils/i18n/localizeText';

interface Props {
  // record.classification 覆寫優先、否則預設推導；皆無（如全 FN）為 undefined。
  classification: BreakoutFindingType | undefined;
  // 是否為手動覆寫（顯「已手動」別於自動推導）。
  overridden: boolean;
  findings: BreakoutFindingView[];
}

const props = defineProps<Props>();

const emit = defineEmits<{ classificationChange: [classification: BreakoutFindingType] }>();

const { t } = useI18n();

// findingType 碼即標籤（與 finding chip 一致、無逐型 i18n）。
const TYPE_OPTIONS: SelectOption[] = breakoutFindingTypeSchema.options.map((type) => ({
  value: type,
  label: type,
}));

// classification 未定（如全 FN 無 finding 完成）時，下拉首列為空值佔位「尚無判讀」。
const options = computed<SelectOption[]>(() =>
  props.classification === undefined
    ? [{ value: '', label: t('breakoutClassificationNone') }, ...TYPE_OPTIONS]
    : TYPE_OPTIONS,
);

function onChange(value: string | undefined): void {
  const parsed = breakoutFindingTypeSchema.safeParse(value);
  if (parsed.success) emit('classificationChange', parsed.data);
}
</script>

<template>
  <section class="breakoutCompletionCard">
    <p class="breakoutCompletionTitle">{{ t('breakoutCompleteTitle') }}</p>
    <div class="breakoutCompletionClassification">
      <span class="breakoutCompletionLabel">{{ t('breakoutClassificationLabel') }}</span>
      <UiSelect
        class="breakoutCompletionSelect"
        v-bind="{ ariaLabel: t('breakoutClassificationLabel') }"
        :options="options"
        :model-value="classification ?? ''"
        @update:model-value="onChange"
      />
      <span v-if="overridden" class="breakoutCompletionManual">
        {{ t('assessmentManualOverride') }}
      </span>
    </div>
    <ul v-if="findings.length > 0" class="breakoutCompletionFindings">
      <li
        v-for="(finding, index) in findings"
        :key="`${finding.findingType}-${index}`"
        class="breakoutCompletionFindingItem"
      >
        <span class="breakoutCompletionChip" :data-pain="finding.findingType === 'PAIN'">
          {{ finding.findingType }}
        </span>
        <span>{{ localizeText(finding.label) }}</span>
        <span v-if="finding.source !== undefined" class="breakoutCompletionSource">
          {{ localizeText(finding.source) }}
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
/* Breakout 完成卡（03 §3.3.9 line 175）：中性卡——標題＋判讀列＋findings 摘要。 */
.breakoutCompletionCard {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.breakoutCompletionTitle {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.breakoutCompletionClassification {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.breakoutCompletionLabel {
  flex: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.breakoutCompletionSelect {
  width: auto;
  min-width: 8rem;
}

.breakoutCompletionManual {
  flex: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.breakoutCompletionFindings {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.breakoutCompletionFindingItem {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.breakoutCompletionChip {
  flex: none;
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--clinical-finding);
  color: #ffffff;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.breakoutCompletionChip[data-pain='true'] {
  background: var(--color-danger);
}

.breakoutCompletionSource {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
