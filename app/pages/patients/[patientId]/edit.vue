<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titlePatientEdit') });
</script>

<template>
  <div>
    <h3>{{ t('titlePatientEdit') }}（placeholder）</h3>
  </div>
</template>
