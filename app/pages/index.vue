<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titlePatients') });
</script>

<template>
  <UCard>
    <h2>{{ t('titlePatients') }}（placeholder）</h2>
    <p>{{ t('screenTodo') }}（Phase 4）</p>
    <UButton to="/settings">{{ t('navSettings') }}</UButton>
  </UCard>
</template>
