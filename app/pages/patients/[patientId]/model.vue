<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titleModel') });
</script>

<template>
  <div>
    <h3>{{ t('titleModel') }}（placeholder）</h3>
    <p>{{ t('screenTodo') }}（Phase 5）</p>
  </div>
</template>
