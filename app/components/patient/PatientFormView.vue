<script setup lang="ts">
// 個案表單展示元件（03 §3.3.8）：純展示——值由父層受控，變更以 change(patch) 上拋（React onChange(patch) 對等）。
// useI18n 由 Nuxt 自動 import。
import UiButton from '../ui/Button.vue';
import UiCheckbox from '../ui/Checkbox.vue';
import UiInput from '../ui/Input.vue';
import type { PatientFormErrors, PatientFormValues } from '../../utils/patient/patientForm';

interface Props {
  mode: 'create' | 'edit';
  values: PatientFormValues;
  errors: PatientFormErrors;
  saving: boolean;
  saveError: boolean;
  canSave: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  change: [patch: Partial<PatientFormValues>];
  submit: [];
  cancel: [];
}>();

const { t } = useI18n();
</script>

<template>
  <form
    class="patientForm"
    @submit.prevent="emit('submit')"
  >
    <label class="patientFormField">
      <span class="patientFormLabel">{{ t('patientFormName') }}</span>
      <UiInput
        :model-value="values.name"
        :placeholder="t('patientFormNamePlaceholder')"
        :aria-invalid="errors.name === 'required' ? true : undefined"
        :aria-describedby="errors.name === 'required' ? 'patientFormNameError' : undefined"
        @update:model-value="emit('change', { name: String($event) })"
      />
      <span
        v-if="errors.name === 'required'"
        id="patientFormNameError"
        role="alert"
        class="patientFormError"
      >
        {{ t('patientFormNameRequired') }}
      </span>
    </label>

    <label class="patientFormField">
      <span class="patientFormLabel">{{ t('patientFormCode') }}</span>
      <UiInput
        :model-value="values.displayCode"
        :placeholder="t('patientFormCodePlaceholder')"
        @update:model-value="emit('change', { displayCode: String($event) })"
      />
    </label>

    <section class="patientFormConsent">
      <template v-if="mode === 'create'">
        <details class="patientFormConsentDetails">
          <summary>{{ t('patientFormConsentTitle') }}</summary>
          <ul class="patientFormConsentList">
            <li>{{ t('patientFormConsentPurpose') }}</li>
            <li>{{ t('patientFormConsentItems') }}</li>
            <li>{{ t('patientFormConsentScope') }}</li>
            <li>{{ t('patientFormConsentPeriod') }}</li>
            <li>{{ t('patientFormConsentRights') }}</li>
          </ul>
        </details>
        <UiCheckbox
          :label="t('patientFormConsentCheckbox')"
          :model-value="values.consentChecked"
          @update:model-value="emit('change', { consentChecked: Boolean($event) })"
        />
      </template>
      <p v-else class="patientFormConsentAcknowledged">
        {{ t('patientFormConsentAlreadyAcknowledged') }}
      </p>
    </section>

    <p v-if="saveError" role="alert" class="patientFormError">
      {{ t('patientFormSaveError') }}
    </p>

    <div class="patientFormActions">
      <UiButton type="button" variant="ghost" @click="emit('cancel')">
        {{ t('patientFormCancel') }}
      </UiButton>
      <UiButton type="submit" :disabled="!canSave || saving">
        {{ t('patientFormSave') }}
      </UiButton>
    </div>
  </form>
</template>

<style scoped>
/* 個案表單版面；顏色取 semantic token（03 §3.3.8、§3.7）。 */
.patientForm {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 32rem;
}

.patientFormField {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.patientFormLabel {
  font-weight: 500;
  font-size: var(--font-size-sm);
}

.patientFormError {
  margin: 0;
  color: var(--color-danger-fg);
  font-size: var(--font-size-sm);
}

.patientFormConsent {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.patientFormConsentDetails summary {
  cursor: pointer;
  font-weight: 500;
}

.patientFormConsentList {
  margin: var(--space-2) 0 0;
  padding-left: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.patientFormConsentAcknowledged {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.patientFormActions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}
</style>
