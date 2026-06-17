import type { AssessmentSession, Patient } from '@ptapp/shared';
import type { Repository } from '../data/repository';

export type PatientSummaryStatus =
  | { kind: 'none' }
  | { kind: 'allFn' }
  | { kind: 'flagged'; dn: number; dp: number };

export interface PatientListItemData {
  patientId: string;
  displayCode?: string;
  name: string;
  lastAssessedAt?: string;
  summary: PatientSummaryStatus;
}

type PatientInput = Pick<Patient, 'patientId' | 'displayCode' | 'name'>;
type SessionSummaryInput = Pick<AssessmentSession, 'assessedAt' | 'summary'>;
type PatientListRepo = Pick<Repository, 'listPatients' | 'listAssessmentsByPatient'>;

// 取最新評估（06 §3.3.8）：無評估→none、有評估但無 DN/DP→allFn、否則 flagged 計數。
export function summarizePatient(
  patient: PatientInput,
  sessions: readonly SessionSummaryInput[],
): PatientListItemData {
  const base: PatientListItemData = {
    patientId: patient.patientId,
    displayCode: patient.displayCode,
    name: patient.name,
    summary: { kind: 'none' },
  };
  if (sessions.length === 0) return base;
  const latest = sessions.reduce((a, b) =>
    new Date(b.assessedAt).getTime() > new Date(a.assessedAt).getTime() ? b : a,
  );
  const { DN, DP } = latest.summary.counts;
  const summary: PatientSummaryStatus =
    DN + DP === 0 ? { kind: 'allFn' } : { kind: 'flagged', dn: DN, dp: DP };
  return { ...base, lastAssessedAt: latest.assessedAt, summary };
}

function comparePatientItems(a: PatientListItemData, b: PatientListItemData): number {
  const ca = a.displayCode ?? '';
  const cb = b.displayCode ?? '';
  if (ca && cb && ca !== cb) return ca < cb ? -1 : 1;
  if (ca && !cb) return -1;
  if (!ca && cb) return 1;
  if (a.name === b.name) return 0;
  return a.name < b.name ? -1 : 1;
}

// 預設排序＝displayCode 升序（無碼者殿後、再以姓名）；使用者可調排序為後續功能。
export function buildPatientListItems(
  patients: readonly Patient[],
  sessionsByPatientId: ReadonlyMap<string, readonly AssessmentSession[]>,
): PatientListItemData[] {
  return patients
    .map((p) => summarizePatient(p, sessionsByPatientId.get(p.patientId) ?? []))
    .sort(comparePatientItems);
}

export function filterPatientItems(
  items: readonly PatientListItemData[],
  query: string,
): PatientListItemData[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter(
    (it) => it.name.toLowerCase().includes(q) || (it.displayCode ?? '').toLowerCase().includes(q),
  );
}

// async 編排（N+1：逐個案讀評估）；local IndexedDB 量級可接受，未來 apiClient 可換批次端點。
export async function loadPatientListItems(repo: PatientListRepo): Promise<PatientListItemData[]> {
  const patients = await repo.listPatients();
  const entries = await Promise.all(
    patients.map(
      async (p): Promise<readonly [string, readonly AssessmentSession[]]> => [
        p.patientId,
        await repo.listAssessmentsByPatient(p.patientId),
      ],
    ),
  );
  return buildPatientListItems(patients, new Map(entries));
}
