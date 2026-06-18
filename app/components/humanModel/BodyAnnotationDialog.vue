<script setup lang="ts">
// 部位標註對話框（04 §4.5 正向連動展示層）：以一般用途 Dialog 包 BodyAnnotationForm。
// 標題＝「加入評估標註 — {部位名}」；× 關閉／表單取消／送出後皆收合。
// 受控 open（v-model）、純展示；容器（model 頁）持有 open 狀態與寫回（upsertAnnotation）。
import type { Side, SfmaPatternDefinition, SfmaPatternKey } from '@ptapp/shared';
import UiDialog from '../base/Dialog.vue';
import BodyAnnotationForm, { type BodyAnnotationDraft } from './BodyAnnotationForm.vue';

const open = defineModel<boolean>('open', { required: true });

interface Props {
  // 部位名（顯於標題）。
  partName: string;
  patterns: readonly SfmaPatternDefinition[];
  initial?: BodyAnnotationDraft;
  // 選填：新增模式之關聯動作預設（finding→模型深連結帶入）；透傳表單，`initial` 優先。
  defaultLinkedPatternKey?: SfmaPatternKey;
  // 側別（取消左右群組化）：成對部位顯左/右分段（預填點選側）；中線 sided=false 不顯。透傳表單。
  sided?: boolean;
  defaultSide?: Side;
  // 休眠慣例（對應 ptApp onRemove）：true＝編輯既有標註，透傳表單顯「移除標註」。
  canRemove?: boolean;
}

withDefaults(defineProps<Props>(), {
  initial: undefined,
  defaultLinkedPatternKey: undefined,
  sided: false,
  defaultSide: null,
  canRemove: false,
});

const emit = defineEmits<{ submit: [draft: BodyAnnotationDraft]; remove: [] }>();

const { t } = useI18n();

function close(): void {
  open.value = false;
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="`${t('anatomyAnnotate')} — ${partName}`"
    :close-label="t('bodyAnnotationClose')"
  >
    <BodyAnnotationForm
      :patterns="patterns"
      :initial="initial"
      :default-linked-pattern-key="defaultLinkedPatternKey"
      :sided="sided"
      :default-side="defaultSide"
      :can-remove="canRemove"
      @submit="emit('submit', $event)"
      @cancel="close"
      @remove="emit('remove')"
    />
  </UiDialog>
</template>
