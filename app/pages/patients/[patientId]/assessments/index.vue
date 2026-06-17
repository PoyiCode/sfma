<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titleAssessments') });
</script>

<template>
  <div>
    <h3>{{ t('titleAssessments') }}（placeholder）</h3>
    <p>{{ t('screenTodo') }}（Phase 4）</p>
  </div>
</template>
