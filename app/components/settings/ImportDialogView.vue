<script setup lang="ts">
// 匯入還原對話框（03 §3.3.8、06 §6.7）：依 useDataImport phase 渲染衝突摘要／策略／套用設定／結果／錯誤。
// open＝phase 非 idle；× 與取消皆走 close（=hook reset）。純展示、邏輯在 useDataImport（容器接線）。
import { computed } from 'vue';
import type { ImportConflictStrategy } from '../../utils/data/repository';
import UiButton from '../ui/Button.vue';
import UiCheckbox from '../ui/Checkbox.vue';
import UiDialog from '../ui/Dialog.vue';
import UiSegmentedControl from '../ui/SegmentedControl.vue';
import type { DataImportPhase } from '../../composables/settings/useDataImport';
import { importErrorMessageKey } from '../../utils/settings/importErrorMessage';

interface Props {
  phase: DataImportPhase;
  conflictStrategy: ImportConflictStrategy;
  applySettings: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  conflictStrategyChange: [strategy: ImportConflictStrategy];
  applySettingsChange: [on: boolean];
  confirm: [];
  close: [];
}>();

const { t } = useI18n();

const open = computed({
  get: () => props.phase.status !== 'idle',
  set: (next: boolean) => {
    if (!next) emit('close');
  },
});

const planned = computed(() => (props.phase.status === 'planned' ? props.phase : undefined));
const conflictPatients = computed(() => planned.value?.plan.conflictingPatientIds.length ?? 0);
const conflictAssessments = computed(() => planned.value?.plan.conflictingSessionIds.length ?? 0);
const hasConflicts = computed(() => conflictPatients.value + conflictAssessments.value > 0);

const conflictMessage = computed(() =>
  t('settingsImportConflict')
    .replace('{patients}', String(conflictPatients.value))
    .replace('{assessments}', String(conflictAssessments.value)),
);

const resultMessage = computed(() => {
  if (props.phase.status !== 'done') return '';
  const { result } = props.phase;
  return t('settingsImportResult')
    .replace('{patientsWritten}', String(result.patientsWritten))
    .replace('{patientsSkipped}', String(result.patientsSkipped))
    .replace('{assessmentsWritten}', String(result.assessmentsWritten))
    .replace('{assessmentsSkipped}', String(result.assessmentsSkipped));
});

const strategyOptions = computed(() => [
  { value: 'skip', label: t('settingsImportStrategySkip') },
  { value: 'overwrite', label: t('settingsImportStrategyOverwrite') },
]);
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="t('settingsImport')"
    :close-label="t('settingsImportClose')"
  >
    <template v-if="planned">
      <template v-if="hasConflicts">
        <p class="importDialogText">{{ conflictMessage }}</p>
        <div class="importDialogField">
          <span class="importDialogLabel">{{ t('settingsImportStrategy') }}</span>
          <UiSegmentedControl
            v-bind="{ ariaLabel: t('settingsImportStrategy') }"
            :model-value="conflictStrategy"
            :options="strategyOptions"
            @update:model-value="
              emit('conflictStrategyChange', $event === 'overwrite' ? 'overwrite' : 'skip')
            "
          />
        </div>
      </template>
      <p v-else class="importDialogText">{{ t('settingsImportReady') }}</p>
      <UiCheckbox
        v-if="planned.plan.hasSettings"
        :label="t('settingsImportApplySettings')"
        :model-value="applySettings"
        @update:model-value="emit('applySettingsChange', $event === true)"
      />
      <div class="importDialogActions">
        <UiButton variant="secondary" @click="emit('close')">
          {{ t('settingsImportCancel') }}
        </UiButton>
        <UiButton variant="primary" @click="emit('confirm')">
          {{ t('settingsImportConfirm') }}
        </UiButton>
      </div>
    </template>

    <p v-else-if="phase.status === 'importing'" class="importDialogText">
      {{ t('settingsImportImporting') }}
    </p>

    <template v-else-if="phase.status === 'done'">
      <p class="importDialogDone">{{ t('settingsImportDone') }}</p>
      <p class="importDialogText">{{ resultMessage }}</p>
      <p v-if="phase.result.settingsApplied" class="importDialogText">
        {{ t('settingsImportSettingsApplied') }}
      </p>
      <div class="importDialogActions">
        <UiButton variant="primary" @click="emit('close')">
          {{ t('settingsImportDoneAction') }}
        </UiButton>
      </div>
    </template>

    <p v-else-if="phase.status === 'error'" role="alert" class="importDialogError">
      {{ t(importErrorMessageKey(phase.code)) }}
    </p>
  </UiDialog>
</template>

<style scoped>
.importDialogText {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.importDialogDone {
  margin: 0;
  font-weight: 700;
}

.importDialogError {
  margin: 0;
  color: var(--color-danger-fg);
}

.importDialogField {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.importDialogLabel {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.importDialogActions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
