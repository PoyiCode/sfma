<script setup lang="ts">
// 個案清單容器（03 §3.3.8）：query 狀態＋usePatientList＋過濾，餵給展示元件。
import { computed, ref } from 'vue';
import { usePatientList } from '../composables/patient/usePatientList';
import { filterPatientItems } from '../utils/patient/patientListItems';
import PageSkeleton from '../components/ui/PageSkeleton.vue';
import PageError from '../components/ui/PageError.vue';
import PatientListView from '../components/patient/PatientListView.vue';

definePageMeta({ titleKey: 'titlePatients' });

const { t } = useI18n();
useHead({ title: () => t('titlePatients') });

const query = ref('');
const { state, reload } = usePatientList();

const items = computed(() =>
  state.value.status === 'ready' ? state.value.items : [],
);
const filteredItems = computed(() => filterPatientItems(items.value, query.value));
</script>

<template>
  <PageSkeleton
    v-if="state.status === 'loading'"
    :label="t('loading')"
    class="patientListStatus"
  />
  <PageError
    v-else-if="state.status === 'error'"
    class="patientListStatus"
    :message="t('patientLoadError')"
    :retry-label="t('retry')"
    @retry="reload"
  />
  <PatientListView
    v-else
    v-model:query="query"
    :items="filteredItems"
    :total-count="items.length"
  />
</template>
