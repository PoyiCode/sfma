import type { Patient } from '@ptapp/shared';
import type { CreatePatientInput } from '../data/repository';

export interface PatientFormValues {
  name: string;
  displayCode: string;
  consentChecked: boolean;
}

export const emptyPatientFormValues: PatientFormValues = {
  name: '',
  displayCode: '',
  consentChecked: false,
};

// 領域錯誤碼（與 i18n 解耦；由畫面映射訊息鍵）。
export interface PatientFormErrors {
  name?: 'required';
}

// 必填僅 name（06 §6.2）。
export function validatePatientForm(values: PatientFormValues): PatientFormErrors {
  const errors: PatientFormErrors = {};
  if (values.name.trim().length === 0) errors.name = 'required';
  return errors;
}

export function isPatientFormValid(values: PatientFormValues): boolean {
  return Object.keys(validatePatientForm(values)).length === 0;
}

export function patientFormValuesFromPatient(patient: Patient): PatientFormValues {
  return {
    name: patient.name,
    displayCode: patient.displayCode ?? '',
    // 編輯時同意已於建立取得（03 §3.3.6）。
    consentChecked: true,
  };
}

// 新增輸入：含呼叫端傳入之同意時間；空代碼不送（repo 自動編號 06 §6.2）。
export function buildCreatePatientInput(
  values: PatientFormValues,
  consentAcknowledgedAt: string,
): CreatePatientInput {
  const input: CreatePatientInput = {
    name: values.name.trim(),
    consentAcknowledgedAt,
  };
  const code = values.displayCode.trim();
  if (code.length > 0) input.displayCode = code;
  return input;
}

// 表單是否有未存變更（與初值逐欄比較；create 初值＝emptyPatientFormValues、edit＝由 patient 衍生）。
export function isPatientFormDirty(values: PatientFormValues, initial: PatientFormValues): boolean {
  return (
    values.name !== initial.name ||
    values.displayCode !== initial.displayCode ||
    values.consentChecked !== initial.consentChecked
  );
}

// 編輯：以既有 patient 為底套用可改欄位；consentAcknowledgedAt 等其他欄位保留（repo 另更新 updatedAt）。
export function buildUpdatedPatient(existing: Patient, values: PatientFormValues): Patient {
  const updated: Patient = { ...existing, name: values.name.trim() };
  const code = values.displayCode.trim();
  if (code.length > 0) updated.displayCode = code;
  else delete updated.displayCode;
  return updated;
}
