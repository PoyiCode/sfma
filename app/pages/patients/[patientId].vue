<script setup lang="ts">
// 個案詳情（03 §3.3.8）：載入個案 → 頭部（姓名·代碼＋編輯＋匯出）＋分頁（評估紀錄⇄人體模型）＋巢狀 NuxtPage。
// 評估／模型內容由 4C 巢狀路由填入，本頁僅做 patient 詳情本體與「匯出此個案」動作。
import { computed, ref } from 'vue';
import { usePatient } from '../../composables/patient/usePatient';
import { localStore } from '../../utils/data/localStore';
import { buildPatientExport, saveExportFile } from '../../utils/data/exporter';
import UiButton from '../../components/ui/Button.vue';
import PageSkeleton from '../../components/ui/PageSkeleton.vue';
import PageError from '../../components/ui/PageError.vue';

const { t } = useI18n();
useHead({ title: () => t('titlePatientDetail') });

const route = useRoute();
const patientId = computed(() => String(route.params.patientId ?? ''));
const { state, reload } = usePatient(patientId);

const exporting = ref(false);
const exportError = ref(false);

async function handleExport(): Promise<void> {
  exporting.value = true;
  exportError.value = false;
  try {
    await saveExportFile(await buildPatientExport(localStore, patientId.value));
  } catch {
    exportError.value = true;
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <PageSkeleton
    v-if="state.status === 'loading'"
    :label="t('loading')"
    class="patientDetailStatus"
  />
  <PageError
    v-else-if="state.status === 'error'"
    class="patientDetailStatus"
    :message="t('patientLoadError')"
    :retry-label="t('retry')"
    @retry="reload"
  />
  <div v-else-if="state.status === 'notFound'" class="patientDetailStatus">
    <p>{{ t('patientNotFound') }}</p>
    <NuxtLink class="button" data-variant="ghost" to="/">{{ t('backToList') }}</NuxtLink>
  </div>
  <section v-else class="patientDetail">
    <header class="patientDetailHeader">
      <div class="patientDetailIdentity">
        <span v-if="state.patient.displayCode" class="patientDetailCode">
          {{ state.patient.displayCode }}
        </span>
        <h2 class="patientDetailName">{{ state.patient.name }}</h2>
      </div>
      <div class="patientDetailActions">
        <NuxtLink
          class="button"
          data-variant="secondary"
          :to="`/patients/${patientId}/edit`"
        >
          {{ t('patientDetailEdit') }}
        </NuxtLink>
        <UiButton variant="secondary" :disabled="exporting" @click="handleExport">
          {{ t('patientDetailExport') }}
        </UiButton>
      </div>
      <p v-if="exportError" role="alert" class="patientDetailError">
        {{ t('patientExportError') }}
      </p>
    </header>
    <nav class="patientDetailTabs">
      <NuxtLink :to="`/patients/${patientId}/assessments`">{{ t('titleAssessments') }}</NuxtLink>
      <NuxtLink :to="`/patients/${patientId}/model`">{{ t('titleModel') }}</NuxtLink>
    </nav>
    <NuxtPage />
  </section>
</template>

<style scoped>
/* 個案詳情頭部與分頁列；顏色取 semantic token（03 §3.7）。 */
.patientDetailHeader {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.patientDetailIdentity {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.patientDetailCode {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

.patientDetailName {
  margin: 0;
  font-size: var(--font-size-xl);
}

.patientDetailActions {
  display: flex;
  gap: var(--space-2);
}

.patientDetailError {
  margin: 0;
  flex-basis: 100%;
  color: var(--color-danger-fg);
  font-size: var(--font-size-sm);
}

.patientDetailStatus {
  color: var(--color-text-muted);
}

.patientDetailTabs {
  display: flex;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-4);
}

.patientDetailTabs a {
  padding: var(--space-2) 0;
  color: var(--color-text-muted);
  text-decoration: none;
  border-bottom: 2px solid transparent;
}

.patientDetailTabs a.router-link-active {
  color: var(--color-accent-fg);
  border-bottom-color: var(--color-accent-fg);
}
</style>
