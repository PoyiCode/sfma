<script setup lang="ts">
// 個案表單容器——編輯（03 §3.3.8）：/patients/:patientId/edit。先載入個案，再以 edit 模式渲染同一編輯器。
import { computed } from 'vue';
import { usePatient } from '../../../composables/patient/usePatient';
import PatientFormEditor from '../../../components/patient/PatientFormEditor.vue';
import PageSkeleton from '../../../components/base/PageSkeleton.vue';
import PageError from '../../../components/base/PageError.vue';

definePageMeta({ titleKey: 'titlePatientEdit' });

const { t } = useI18n();
useHead({ title: () => t('titlePatientEdit') });

const route = useRoute();
const patientId = computed(() => String(route.params.patientId));
const { state, reload } = usePatient(patientId);
</script>

<template>
  <PageSkeleton v-if="state.status === 'loading'" :label="t('loading')" class="patientFormStatus" />
  <PageError
    v-else-if="state.status === 'error'"
    class="patientFormStatus"
    :message="t('patientLoadError')"
    :retry-label="t('retry')"
    @retry="reload"
  />
  <div v-else-if="state.status === 'notFound'" class="patientFormStatus">
    <p>{{ t('patientNotFound') }}</p>
    <NuxtLink class="button" data-variant="ghost" to="/">{{ t('backToList') }}</NuxtLink>
  </div>
  <PatientFormEditor v-else :patient="state.patient" />
</template>

<style scoped>
.patientFormStatus {
  color: var(--color-text-muted);
}
</style>
