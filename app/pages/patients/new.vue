<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titlePatientNew') });
</script>

<template>
  <UCard>
    <h2>{{ t('titlePatientNew') }}（placeholder）</h2>
    <p>{{ t('screenTodo') }}（Phase 4）</p>
  </UCard>
</template>
