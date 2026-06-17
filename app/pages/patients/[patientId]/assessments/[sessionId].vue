<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titleAssessmentSession') });
</script>

<template>
  <div>
    <h3>{{ t('titleAssessmentSession') }}（placeholder）</h3>
  </div>
</template>
