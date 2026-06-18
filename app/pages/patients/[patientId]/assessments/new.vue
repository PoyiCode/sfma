<script setup lang="ts">
// /patients/:patientId/assessments/new：建立空白評估（綁預設評估者）後 replace 導向 :sessionId。
// 評估逐步寫入、不需未存草稿守衛（03 §3.3.5）。建立以 created 旗標守衛避免重複建立；失敗顯錯＋重試。
import { onMounted, ref } from 'vue';
import { createUuid, toIsoDateTime } from '@ptapp/shared';
import { localStore } from '../../../../utils/data/localStore';
import { newAssessmentSession } from '../../../../utils/assessment/assessmentSession';
import UiButton from '../../../../components/ui/Button.vue';
import PageSkeleton from '../../../../components/ui/PageSkeleton.vue';

const { t } = useI18n();
useHead({ title: () => t('titleAssessmentNew') });

const route = useRoute();
const created = ref(false);
const failed = ref(false);

async function createSession(): Promise<void> {
  const patientId = String(route.params.patientId ?? '');
  if (created.value || !patientId) return;
  created.value = true;
  try {
    const settings = await localStore.getSettings();
    const assessor = settings?.therapistProfile ?? { assessorId: createUuid(), name: '' };
    const session = newAssessmentSession(
      createUuid(),
      patientId,
      assessor,
      toIsoDateTime(new Date()),
    );
    await localStore.saveAssessment(session);
    await navigateTo(`/patients/${patientId}/assessments/${session.sessionId}`, { replace: true });
  } catch {
    created.value = false;
    failed.value = true;
  }
}

function retry(): void {
  failed.value = false;
  void createSession();
}

onMounted(() => {
  void createSession();
});
</script>

<template>
  <p v-if="failed" role="alert">
    {{ t('assessmentCreateError') }}
    <UiButton @click="retry">{{ t('retry') }}</UiButton>
  </p>
  <PageSkeleton v-else :label="t('loading')" />
</template>
