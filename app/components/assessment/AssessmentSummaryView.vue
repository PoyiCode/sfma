<script setup lang="ts">
// 評估總覽（只讀；05 §5.1「總分」、§5.4、06 §6.3）：分類統計＋疼痛部位＋功能異常部位＋Breakout 發現一覽。
// 資料取自資料層衍生快取 session.summary（patterns 變更即重算）與 session.breakouts；UI 不自行計算。
import { computed } from 'vue';
import type { AssessmentSession, PatternClassification } from '@ptapp/shared';
import UiStatusChip from '../base/StatusChip.vue';
import type { AssessmentEntry } from '../../utils/assessment/assessmentForm';
import {
  breakoutFindingsOverview,
  summaryPatternViews,
  type SummaryPatternView,
} from '../../utils/assessment/assessmentSummary';
import { localizeText } from '../../utils/i18n/localizeText';

const CLASS_ORDER: readonly PatternClassification[] = ['FN', 'FP', 'DN', 'DP'];

interface Props {
  session: AssessmentSession;
  entries: AssessmentEntry[];
}

const props = defineProps<Props>();

const { t } = useI18n();

function sideSuffix(side: SummaryPatternView['side']): string {
  if (side === 'left') return `（${t('assessmentSideLeft')}）`;
  if (side === 'right') return `（${t('assessmentSideRight')}）`;
  return '';
}

const counts = computed(() => props.session.summary.counts);
const painful = computed(() =>
  summaryPatternViews(props.session.summary.painfulPatterns, props.entries),
);
const dysfunctional = computed(() =>
  summaryPatternViews(props.session.summary.dysfunctionalPatterns, props.entries),
);
const findings = computed(() => breakoutFindingsOverview(props.session.breakouts, props.entries));
</script>

<template>
  <section class="assessmentSummary" :aria-label="t('assessmentSummaryTitle')">
    <h2 class="assessmentSummaryTitle">{{ t('assessmentSummaryTitle') }}</h2>

    <div class="assessmentSummaryGroup">
      <h3 class="assessmentSummaryHeading">{{ t('assessmentSummaryCounts') }}</h3>
      <ul class="assessmentSummaryCountList">
        <li v-for="code in CLASS_ORDER" :key="code" class="assessmentSummaryCount">
          <UiStatusChip :status="code" />
          <span class="assessmentSummaryCountValue">{{ counts[code] }}</span>
        </li>
      </ul>
    </div>

    <div class="assessmentSummaryGroup">
      <h3 class="assessmentSummaryHeading">{{ t('assessmentSummaryPainful') }}</h3>
      <p v-if="painful.length === 0" class="assessmentSummaryEmpty">
        {{ t('assessmentSummaryEmpty') }}
      </p>
      <ul v-else class="assessmentSummaryList">
        <li v-for="view in painful" :key="view.key">
          {{ localizeText(view.name) }}{{ sideSuffix(view.side) }}
        </li>
      </ul>
    </div>

    <div class="assessmentSummaryGroup">
      <h3 class="assessmentSummaryHeading">{{ t('assessmentSummaryDysfunction') }}</h3>
      <p v-if="dysfunctional.length === 0" class="assessmentSummaryEmpty">
        {{ t('assessmentSummaryEmpty') }}
      </p>
      <ul v-else class="assessmentSummaryList">
        <li v-for="view in dysfunctional" :key="view.key">
          {{ localizeText(view.name) }}{{ sideSuffix(view.side) }}
        </li>
      </ul>
    </div>

    <div class="assessmentSummaryGroup">
      <h3 class="assessmentSummaryHeading">{{ t('assessmentSummaryFindings') }}</h3>
      <p v-if="findings.length === 0" class="assessmentSummaryEmpty">
        {{ t('assessmentSummaryEmpty') }}
      </p>
      <ul v-else class="assessmentSummaryFindingList">
        <li v-for="row in findings" :key="row.key" class="assessmentSummaryFindingRow">
          <span class="assessmentSummaryFindingName">
            {{ localizeText(row.name) }}{{ sideSuffix(row.side) }}
          </span>
          <span class="assessmentSummaryFindingTypes">
            <span
              v-for="(finding, index) in row.findings"
              :key="`${finding.findingType}-${index}`"
              class="assessmentSummaryFindingType"
              :data-pain="finding.findingType === 'PAIN'"
            >
              {{ finding.findingType }}：{{ localizeText(finding.label) }}
            </span>
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.assessmentSummary {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  margin-top: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.assessmentSummaryTitle {
  margin: 0;
  font-size: var(--font-size-lg);
}

.assessmentSummaryGroup {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.assessmentSummaryHeading {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.assessmentSummaryCountList {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.assessmentSummaryCount {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.assessmentSummaryCountValue {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.assessmentSummaryList {
  margin: 0;
  padding-left: var(--space-5);
}

.assessmentSummaryEmpty {
  margin: 0;
  color: var(--color-text-muted);
}

.assessmentSummaryFindingList {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.assessmentSummaryFindingRow {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.assessmentSummaryFindingName {
  font-weight: 500;
}

.assessmentSummaryFindingTypes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.assessmentSummaryFindingType {
  flex: none;
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--clinical-finding);
  color: #ffffff;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.assessmentSummaryFindingType[data-pain='true'] {
  background: var(--color-danger);
}
</style>
