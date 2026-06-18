<script setup lang="ts">
// 評估紀錄清單展示（03 §3.3.8）：純展示——空狀態引導＋新增 CTA；有資料則列各次評估（日期·概況·評估者）。
// useI18n／NuxtLink 由 Nuxt 自動 import。
import UiStatusChip from '../ui/StatusChip.vue';
import type { AssessmentRowData } from '../../utils/assessment/assessmentHistory';

interface Props {
  patientId: string;
  rows: AssessmentRowData[];
}

defineProps<Props>();

const { t } = useI18n();
</script>

<template>
  <div v-if="rows.length === 0" class="assessmentHistoryEmpty">
    <p class="assessmentHistoryEmptyTitle">{{ t('patientNoAssessments') }}</p>
    <p class="assessmentHistoryEmptyHint">{{ t('assessmentHistoryEmptyHint') }}</p>
    <NuxtLink
      class="button"
      data-variant="primary"
      :to="`/patients/${patientId}/assessments/new`"
    >
      {{ t('titleAssessmentNew') }}
    </NuxtLink>
  </div>
  <div v-else class="assessmentHistory">
    <div class="assessmentHistoryHeader">
      <NuxtLink
        class="button"
        data-variant="primary"
        :to="`/patients/${patientId}/assessments/new`"
      >
        {{ t('titleAssessmentNew') }}
      </NuxtLink>
    </div>
    <ul class="assessmentRows">
      <li v-for="row in rows" :key="row.sessionId" class="assessmentRow">
        <NuxtLink
          class="assessmentRowLink"
          :to="`/patients/${patientId}/assessments/${row.sessionId}`"
        >
          <span class="assessmentRowDate">{{ row.assessedAt.slice(0, 10) }}</span>
          <span v-if="row.dn === 0 && row.dp === 0" class="assessmentRowAllFn">
            {{ t('patientAllFn') }}
          </span>
          <span v-else class="assessmentRowFlags">
            <span v-if="row.dp > 0" class="assessmentRowFlag">
              <UiStatusChip status="DP" />
              <span class="assessmentRowCount">×{{ row.dp }}</span>
            </span>
            <span v-if="row.dn > 0" class="assessmentRowFlag">
              <UiStatusChip status="DN" />
              <span class="assessmentRowCount">×{{ row.dn }}</span>
            </span>
          </span>
          <span class="assessmentRowAssessor">{{ row.assessorName }}</span>
          <span class="assessmentRowChevron" aria-hidden="true">›</span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* 評估紀錄清單；顏色取 semantic token（03 §3.3.8、§3.7）。 */
.assessmentHistoryHeader {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-4);
}

.assessmentRows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.assessmentRowLink {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--control-height);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  text-decoration: none;
}

.assessmentRowDate {
  font-variant-numeric: tabular-nums;
}

.assessmentRowFlags {
  display: inline-flex;
  gap: var(--space-2);
}

.assessmentRowFlag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.assessmentRowCount {
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.assessmentRowAllFn {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.assessmentRowAssessor {
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.assessmentRowChevron {
  color: var(--color-text-muted);
}

.assessmentHistoryEmpty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-12) var(--space-4);
  text-align: center;
}

.assessmentHistoryEmptyTitle {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 500;
}

.assessmentHistoryEmptyHint {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
