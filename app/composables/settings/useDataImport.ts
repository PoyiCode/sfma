import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { localStore } from '../../utils/data/localStore';
import type { ImportConflictStrategy, ImportResult, Repository } from '../../utils/data/repository';
import {
  executeImport,
  ImportError,
  planImport,
  readImportFile,
  type ImportErrorCode,
  type ImportPlan,
} from '../../utils/data/importer';

// planImport 用 getPatient／getAssessment、executeImport 用 importBatch；僅注入所需面以利測試脫鉤。
type ImportRepo = Pick<Repository, 'getPatient' | 'getAssessment' | 'importBatch'>;

// 匯入流程狀態機（06 §6.7）：idle → planned（待對話框決定）→ importing → done｜error。
export type DataImportPhase =
  | { status: 'idle' }
  | { status: 'planned'; plan: ImportPlan }
  | { status: 'importing' }
  | { status: 'done'; result: ImportResult }
  | { status: 'error'; code: ImportErrorCode | 'unknown' };

export interface UseDataImportResult {
  phase: Ref<DataImportPhase>;
  // 對話框開關衍生：phase 非 idle 即開（含 planned／importing／done／error）。
  open: ComputedRef<boolean>;
  conflictStrategy: Ref<ImportConflictStrategy>;
  applySettings: Ref<boolean>;
  // 選檔：解析＋規劃；失敗以代碼進 error（非 ImportError 歸 'unknown'）。
  selectFile: (file: { text(): Promise<string> }) => Promise<void>;
  // 確認匯入：以當前 conflictStrategy／applySettings 交易性寫入。
  confirmImport: () => Promise<void>;
  reset: () => void;
}

// 匯入還原控制 composable（06 §6.7、03 §3.3.8）：橋接資料層匯入四步驟為設定頁對話框狀態。
// repo 末位選填注入（預設 localStore）供 fake repo 脫鉤測（比照 useSettings）。
export function useDataImport(repo: ImportRepo = localStore): UseDataImportResult {
  const phase = ref<DataImportPhase>({ status: 'idle' });
  const conflictStrategy = ref<ImportConflictStrategy>('skip');
  const applySettings = ref(false);

  const open = computed(() => phase.value.status !== 'idle');

  async function selectFile(file: { text(): Promise<string> }): Promise<void> {
    conflictStrategy.value = 'skip';
    applySettings.value = false;
    try {
      const envelope = await readImportFile(file);
      const plan = await planImport(repo, envelope);
      phase.value = { status: 'planned', plan };
    } catch (error) {
      phase.value = {
        status: 'error',
        code: error instanceof ImportError ? error.code : 'unknown',
      };
    }
  }

  async function confirmImport(): Promise<void> {
    const current = phase.value;
    if (current.status !== 'planned') return;
    const { plan } = current;
    phase.value = { status: 'importing' };
    try {
      const result = await executeImport(repo, plan, {
        conflictStrategy: conflictStrategy.value,
        applySettings: applySettings.value,
      });
      phase.value = { status: 'done', result };
    } catch (error) {
      phase.value = {
        status: 'error',
        code: error instanceof ImportError ? error.code : 'unknown',
      };
    }
  }

  function reset(): void {
    phase.value = { status: 'idle' };
  }

  return {
    phase,
    open,
    conflictStrategy,
    applySettings,
    selectFile,
    confirmImport,
    reset,
  };
}
