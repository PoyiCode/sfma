<script setup lang="ts">
definePageMeta({ titleKey: 'notFound' });

const { t } = useI18n();
useHead({ title: () => t('notFound') });
</script>

<template>
  <UCard>
    <h2>{{ t('notFound') }}</h2>
    <UButton to="/">{{ t('backHome') }}</UButton>
  </UCard>
</template>
