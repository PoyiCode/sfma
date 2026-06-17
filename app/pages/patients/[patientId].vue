<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
useHead({ title: () => t('titlePatientDetail') });
</script>

<template>
  <UCard>
    <h2>{{ t('titlePatientDetail') }}（placeholder）— id: {{ route.params.patientId }}</h2>
    <NuxtPage />
  </UCard>
</template>
