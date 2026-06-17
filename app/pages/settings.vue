<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titleSettings') });
</script>

<template>
  <UCard>
    <h2>{{ t('titleSettings') }}（placeholder）</h2>
    <p>{{ t('screenTodo') }}（Phase 6）</p>
    <UButton to="/">{{ t('backHome') }}</UButton>
  </UCard>
</template>
