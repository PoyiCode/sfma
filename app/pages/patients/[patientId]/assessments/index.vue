<script setup lang="ts">
// 評估紀錄容器（03 §3.3.8）：取 patientId＋useAssessmentHistory，餵給展示元件。
import { computed } from 'vue';
import { useAssessmentHistory } from '../../../../composables/assessment/useAssessmentHistory';
import AssessmentHistoryView from '../../../../components/assessment/AssessmentHistoryView.vue';
import PageError from '../../../../components/ui/PageError.vue';
import PageSkeleton from '../../../../components/ui/PageSkeleton.vue';

definePageMeta({ titleKey: 'titleAssessments' });

const { t } = useI18n();
useHead({ title: () => t('titleAssessments') });

const route = useRoute();
const patientId = computed(() => String(route.params.patientId ?? ''));
const { state, reload } = useAssessmentHistory(patientId);
</script>

<template>
  <PageSkeleton
    v-if="state.status === 'loading'"
    :label="t('loading')"
    class="assessmentHistoryStatus"
  />
  <PageError
    v-else-if="state.status === 'error'"
    class="assessmentHistoryStatus"
    :message="t('assessmentLoadError')"
    :retry-label="t('retry')"
    @retry="reload"
  />
  <AssessmentHistoryView v-else :patient-id="patientId" :rows="state.rows" />
</template>
