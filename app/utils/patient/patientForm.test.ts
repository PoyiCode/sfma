import { describe, expect, it } from 'vitest';
import type { Patient } from '@ptapp/shared';
import {
  buildCreatePatientInput,
  buildUpdatedPatient,
  emptyPatientFormValues,
  isPatientFormDirty,
  isPatientFormValid,
  patientFormValuesFromPatient,
  validatePatientForm,
} from './patientForm';

function patient(): Patient {
  return {
    schemaVersion: 1,
    patientId: 'p1',
    displayCode: 'P001',
    name: '王小明',
    notes: '保留欄位',
    createdAt: '2026-06-01T09:00:00+08:00',
    updatedAt: '2026-06-01T09:00:00+08:00',
    consentAcknowledgedAt: '2026-06-01T09:00:00+08:00',
  };
}

describe('validatePatientForm／isPatientFormValid', () => {
  it('姓名空白 → name required', () => {
    expect(validatePatientForm({ ...emptyPatientFormValues, name: '   ' })).toEqual({
      name: 'required',
    });
    expect(isPatientFormValid({ ...emptyPatientFormValues, name: '   ' })).toBe(false);
  });

  it('姓名有值 → 無錯誤', () => {
    expect(validatePatientForm({ ...emptyPatientFormValues, name: '王' })).toEqual({});
    expect(isPatientFormValid({ ...emptyPatientFormValues, name: '王' })).toBe(true);
  });
});

describe('buildCreatePatientInput', () => {
  it('trim 姓名、帶同意時間；空代碼不送（交由 repo 自動編號）', () => {
    const input = buildCreatePatientInput(
      { name: '  王小明  ', displayCode: '   ', consentChecked: true },
      '2026-06-13T10:00:00+08:00',
    );
    expect(input).toEqual({ name: '王小明', consentAcknowledgedAt: '2026-06-13T10:00:00+08:00' });
  });

  it('有代碼則 trim 後送出', () => {
    const input = buildCreatePatientInput(
      { name: '王', displayCode: '  P009 ', consentChecked: true },
      '2026-06-13T10:00:00+08:00',
    );
    expect(input.displayCode).toBe('P009');
  });
});

describe('buildUpdatedPatient', () => {
  it('保留 consentAcknowledgedAt 與其他欄位、更新姓名／代碼', () => {
    const updated = buildUpdatedPatient(patient(), {
      name: '王大明',
      displayCode: 'P002',
      consentChecked: true,
    });
    expect(updated.name).toBe('王大明');
    expect(updated.displayCode).toBe('P002');
    expect(updated.consentAcknowledgedAt).toBe('2026-06-01T09:00:00+08:00');
    expect(updated.notes).toBe('保留欄位');
    expect(updated.patientId).toBe('p1');
  });

  it('代碼清空 → 移除 displayCode', () => {
    const updated = buildUpdatedPatient(patient(), {
      name: '王',
      displayCode: '   ',
      consentChecked: true,
    });
    expect(updated.displayCode).toBeUndefined();
  });
});

describe('patientFormValuesFromPatient', () => {
  it('映射姓名／代碼、編輯模式視同已同意', () => {
    expect(patientFormValuesFromPatient(patient())).toEqual({
      name: '王小明',
      displayCode: 'P001',
      consentChecked: true,
    });
  });
});

describe('isPatientFormDirty', () => {
  it('與初值相同為 false、任一欄變動為 true', () => {
    expect(isPatientFormDirty(emptyPatientFormValues, emptyPatientFormValues)).toBe(false);
    expect(
      isPatientFormDirty({ ...emptyPatientFormValues, name: '王' }, emptyPatientFormValues),
    ).toBe(true);
    expect(
      isPatientFormDirty({ ...emptyPatientFormValues, displayCode: 'P1' }, emptyPatientFormValues),
    ).toBe(true);
    expect(
      isPatientFormDirty(
        { ...emptyPatientFormValues, consentChecked: true },
        emptyPatientFormValues,
      ),
    ).toBe(true);
  });
});
