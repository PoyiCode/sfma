<script setup lang="ts">
// 個案清單展示元件（03 §3.3.8）：純展示——搜尋框＋新增 CTA＋清單列；query 由父層受控（v-model）。
// useI18n／NuxtLink 由 Nuxt 自動 import。
import BaseInput from '../base/Input.vue';
import BaseStatusChip from '../base/StatusChip.vue';
import type { PatientListItemData } from '../../utils/patient/patientListItems';

interface Props {
  items: PatientListItemData[];
  totalCount: number;
}

defineProps<Props>();

// 搜尋字串：受控（父層持有 query 狀態），React value/onChange → Vue v-model。
const query = defineModel<string>('query', { required: true });

const { t } = useI18n();
</script>

<template>
  <div v-if="totalCount === 0" class="patientListEmpty">
    <p class="patientListEmptyTitle">{{ t('patientListEmptyTitle') }}</p>
    <p class="patientListEmptyHint">{{ t('patientListEmptyHint') }}</p>
    <NuxtLink class="button" data-variant="primary" to="/patients/new">
      {{ t('patientAddCta') }}
    </NuxtLink>
  </div>
  <div v-else class="patientList">
    <div class="patientListHeader">
      <BaseInput
        v-model="query"
        type="search"
        class="patientSearch"
        :placeholder="t('patientSearchPlaceholder')"
        :aria-label="t('patientSearchPlaceholder')"
      />
      <NuxtLink class="button" data-variant="primary" to="/patients/new">
        {{ t('patientAddCta') }}
      </NuxtLink>
    </div>
    <p v-if="items.length === 0" class="patientListNoMatch">{{ t('patientListNoMatch') }}</p>
    <ul v-else class="patientRows">
      <li v-for="item in items" :key="item.patientId" class="patientRow">
        <NuxtLink class="patientRowLink" :to="`/patients/${item.patientId}`">
          <span class="patientRowMain">
            <span v-if="item.displayCode" class="patientRowCode eyebrow">{{
              item.displayCode
            }}</span>
            <span class="patientRowName">{{ item.name }}</span>
          </span>
          <span class="patientRowMeta">
            <span v-if="item.summary.kind === 'none'" class="patientSummaryMuted">
              {{ t('patientNoAssessments') }}
            </span>
            <span v-else-if="item.summary.kind === 'allFn'" class="patientSummaryMuted">
              {{ t('patientAllFn') }}
            </span>
            <span v-else class="patientSummaryFlags">
              <span v-if="item.summary.dp > 0" class="patientSummaryFlag">
                <BaseStatusChip status="DP" />
                <span class="patientSummaryCount dataText">×{{ item.summary.dp }}</span>
              </span>
              <span v-if="item.summary.dn > 0" class="patientSummaryFlag">
                <BaseStatusChip status="DN" />
                <span class="patientSummaryCount dataText">×{{ item.summary.dn }}</span>
              </span>
            </span>
            <span v-if="item.lastAssessedAt" class="patientRowDate dataText">
              {{ item.lastAssessedAt.slice(0, 10) }}
            </span>
          </span>
          <svg
            class="patientRowChevron"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* 個案清單版面；顏色取 semantic token（03 §3.3.8、§3.7）。 */
.patientListHeader {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  margin-bottom: var(--space-4);
}

.patientSearch {
  flex: 1;
}

.patientRows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.patientRowLink {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--control-height);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  text-decoration: none;
  transition:
    border-color var(--motion-fast) var(--easing-standard),
    box-shadow var(--motion-fast) var(--easing-standard);
}

.patientRowLink:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-1);
}

/* 左欄：兩層——代碼 eyebrow（mono）在上、姓名（重）在下。 */
.patientRowMain {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.patientRowCode {
  /* 字排取全域 .eyebrow（mono/大寫/字距）；此處僅微調行高 */
  line-height: 1.2;
}

.patientRowName {
  font-weight: 600;
  letter-spacing: var(--tracking-tight);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 右欄：狀態概況在上、日期（mono 讀值）在下，右對齊。 */
.patientRowMeta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
  margin-left: auto;
  text-align: right;
}

.patientSummaryFlags {
  display: inline-flex;
  gap: var(--space-2);
}

.patientSummaryFlag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.patientSummaryCount {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.patientSummaryMuted {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.patientRowDate {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.patientRowChevron {
  flex: none;
  color: var(--color-text-muted);
}

.patientListEmpty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-12) var(--space-4);
  text-align: center;
}

.patientListEmptyTitle {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 500;
}

.patientListEmptyHint {
  margin: 0;
  color: var(--color-text-muted);
}

.patientListNoMatch {
  color: var(--color-text-muted);
}
</style>
