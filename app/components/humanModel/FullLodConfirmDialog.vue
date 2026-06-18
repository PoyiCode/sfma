<script setup lang="ts">
// 「完整」LOD 切換流量確認對話框（解3d資產「完整」級別）：建於 ui/AlertDialog（受控），
// 非破壞性（流量警示、非作廢）。設定頁與檢視器內 LOD 控制共用——切換至 full 前跳此提醒。
import BaseAlertDialog from '../base/AlertDialog.vue';

const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ confirm: [] }>();

const { t } = useI18n();
</script>

<template>
  <BaseAlertDialog
    v-model:open="open"
    :title="t('fullLodConfirmTitle')"
    :description="t('fullLodConfirmBody')"
    :cancel-label="t('fullLodConfirmCancel')"
    :action-label="t('fullLodConfirmAction')"
    @confirm="emit('confirm')"
  />
</template>
