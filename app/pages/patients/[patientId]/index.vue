<script setup lang="ts">
const route = useRoute();
await navigateTo(`/patients/${route.params.patientId}/assessments`, { replace: true });
</script>

<template>
  <div />
</template>
