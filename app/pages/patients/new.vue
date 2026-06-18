<script setup lang="ts">
// 個案表單容器——新增（03 §3.3.8）：/patients/new。建立模式直接渲染編輯器。
import PatientFormEditor from '../../components/patient/PatientFormEditor.vue';

definePageMeta({ titleKey: 'titlePatientNew' });

const { t } = useI18n();
useHead({ title: () => t('titlePatientNew') });
</script>

<template>
  <PatientFormEditor />
</template>
