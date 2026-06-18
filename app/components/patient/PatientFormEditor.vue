<script setup lang="ts">
// 個案表單編輯器（03 §3.3.8）：建立／編輯共用——持有表單值、驗證、存檔與未存變更守衛。
// 對應 React PatientFormEditor；create 模式 initial＝emptyPatientFormValues，edit 模式由 patient 衍生。
// useI18n／navigateTo／useRouter 由 Nuxt 自動 import。
import { computed, reactive, ref } from 'vue';
import { toIsoDateTime, type Patient } from '@ptapp/shared';
import { localStore } from '../../utils/data/localStore';
import {
  buildCreatePatientInput,
  buildUpdatedPatient,
  emptyPatientFormValues,
  isPatientFormDirty,
  isPatientFormValid,
  patientFormValuesFromPatient,
  validatePatientForm,
  type PatientFormValues,
} from '../../utils/patient/patientForm';
import { useUnsavedChangesGuard } from '../../composables/patient/useUnsavedChangesGuard';
import PatientFormView from './PatientFormView.vue';
import UiAlertDialog from '../base/AlertDialog.vue';

interface Props {
  // 編輯模式須帶既有 patient；建立模式 patient 省略。
  patient?: Patient;
}

const props = defineProps<Props>();

const { t } = useI18n();
const router = useRouter();

const mode = computed<'create' | 'edit'>(() => (props.patient ? 'edit' : 'create'));
const initial = props.patient
  ? patientFormValuesFromPatient(props.patient)
  : { ...emptyPatientFormValues };

const values = reactive<PatientFormValues>({ ...initial });
const saving = ref(false);
const saveError = ref(false);

const errors = computed(() => validatePatientForm(values));
// 建立模式須勾選同意；編輯模式同意已於建立取得。
const canSave = computed(
  () => isPatientFormValid(values) && (mode.value === 'edit' || values.consentChecked),
);

// 未存變更守衛（03 §3.3.5）：有未存草稿且非存檔中才攔截離開（成功存檔之 navigate 不自攔——存檔後值＝已存，dirty 為 false）。
const guard = useUnsavedChangesGuard(() => isPatientFormDirty(values, initial) && !saving.value);

function applyPatch(patch: Partial<PatientFormValues>): void {
  Object.assign(values, patch);
}

async function handleSubmit(): Promise<void> {
  if (!canSave.value || saving.value) return;
  saving.value = true;
  saveError.value = false;
  try {
    if (mode.value === 'create') {
      const created = await localStore.createPatient(
        buildCreatePatientInput({ ...values }, toIsoDateTime(new Date())),
      );
      await navigateTo(`/patients/${created.patientId}`);
    } else {
      // mode === 'edit' 時 props.patient 必存在。
      const updated = await localStore.updatePatient(
        buildUpdatedPatient(props.patient as Patient, { ...values }),
      );
      await navigateTo(`/patients/${updated.patientId}`);
    }
  } catch {
    saveError.value = true;
    saving.value = false;
  }
}

function handleDialogOpenChange(open: boolean): void {
  // 對話框關閉（含 Cancel／點外部）視為取消導航，留在原頁；confirm 另由 @confirm 放行。
  if (!open && guard.blocked.value) guard.cancel();
}
</script>

<template>
  <div>
    <PatientFormView
      :mode="mode"
      :values="values"
      :errors="errors"
      :saving="saving"
      :save-error="saveError"
      :can-save="canSave"
      @change="applyPatch"
      @submit="handleSubmit"
      @cancel="router.back()"
    />
    <UiAlertDialog
      :open="guard.blocked.value"
      :title="t('unsavedGuardTitle')"
      :description="t('unsavedGuardDescription')"
      :cancel-label="t('unsavedGuardCancel')"
      :action-label="t('unsavedGuardConfirm')"
      destructive
      @update:open="handleDialogOpenChange"
      @confirm="guard.confirm"
    />
  </div>
</template>
