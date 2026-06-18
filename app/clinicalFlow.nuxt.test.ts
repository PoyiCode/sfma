// 核心臨床流程 Nuxt 整合測試（todo 08「主流程」之 jsdom 接縫；對等 ptApp clinicalFlow.test.tsx）。
//
// 取捨（環境受限——詳見回報）：本機（WSL2＋jsdom）下 @nuxt/test-utils 之 renderSuspended/mountSuspended
// 對 route-target 頁元件渲染出現非確定性卡死（Nuxt env fork 啟動偶卡、router 重入），無法穩定驅動
// 完整頁面互動。故於 Nuxt `environment: 'nuxt'` runtime context 下以「真實容器 composable
//（usePatientList）＋真實 localStore＋fake-indexeddb」直驅，覆蓋「建立個案 → 落盤 → 清單讀取 →
// summary 衍生」之跨層接縫（孤立單元測各自打樁、看不到此連貫接縫）。評估輸入→Breakout→標註之
// 互動接縫已由 ptApp jsdom 整合測試語意涵蓋、並由 Playwright E2E（e2e/mainFlow.spec.ts）於真實
// 瀏覽器驗完整旅程；本檔聚焦資料連貫之穩定接縫。
import { afterEach, describe, expect, it } from 'vitest';
import { effectScope } from 'vue';
import { waitFor } from '@testing-library/vue';
import { localStore } from './utils/data/localStore';
import { newAssessmentSession } from './utils/assessment/assessmentSession';
import { usePatientList } from './composables/patient/usePatientList';
import { createUuid, toIsoDateTime } from '@ptapp/shared';

afterEach(async () => {
  const patients = await localStore.listPatients();
  for (const patient of patients) await localStore.deletePatient(patient.patientId);
});

function runScoped<T>(setup: () => T): { result: T; stop: () => void } {
  const scope = effectScope();
  const result = scope.run(setup) as T;
  return { result, stop: () => scope.stop() };
}

describe('核心臨床流程整合（真實 composable＋localStore＋fake-indexeddb，Nuxt runtime）', () => {
  it('落盤→清單讀取接縫：建立個案後 usePatientList 載入即入列、空態消失、summary 衍生為 none（persist→list→衍生）', async () => {
    // 空態：清單 ready 且為空（list 讀取接縫起點）。
    const empty = runScoped(() => usePatientList(localStore));
    await waitFor(() => expect(empty.result.state.value.status).toBe('ready'));
    expect(empty.result.state.value).toMatchObject({ status: 'ready', items: [] });
    empty.stop();

    // 真實 localStore 落盤一個案（對等 PatientFormEditor 儲存）；consent 閘門記錄已存。
    const patient = await localStore.createPatient({
      name: '整合測試個案',
      consentAcknowledgedAt: '2026-06-16T09:00:00+08:00',
    });
    expect(patient.consentAcknowledgedAt).toBeTruthy();

    // 清單重載（對等清單頁重渲）：個案入列、無評估 → summary 衍生為 none。
    const reloaded = runScoped(() => usePatientList(localStore));
    await waitFor(() => expect(reloaded.result.state.value.status).toBe('ready'));
    const listState = reloaded.result.state.value;
    const items = listState.status === 'ready' ? listState.items : [];
    const created = items.find((item) => item.name === '整合測試個案');
    expect(created).toBeDefined();
    expect(created?.summary.kind).toBe('none');
    reloaded.stop();
  });

  it('評估摘要衍生接縫：個案＋評估落盤後清單彙整顯示其最新評估狀態（assessment→summarize→list 接縫）', async () => {
    // 建個案＋一筆評估（patterns 留空＝allFn：有評估但無 DN/DP）。
    const patient = await localStore.createPatient({
      name: '彙整測試個案',
      consentAcknowledgedAt: '2026-06-16T09:00:00+08:00',
    });
    const session = newAssessmentSession(
      createUuid(),
      patient.patientId,
      { assessorId: createUuid(), name: '王治療師' },
      toIsoDateTime(new Date()),
    );
    await localStore.saveAssessment(session);

    // 清單載入：summarizePatient 衍生「有評估、無 DN/DP」→ allFn（list 跨 patient×assessment 彙整接縫）。
    const { result, stop } = runScoped(() => usePatientList(localStore));
    await waitFor(() => expect(result.state.value.status).toBe('ready'));
    const state = result.state.value;
    const item =
      state.status === 'ready'
        ? state.items.find((entry) => entry.name === '彙整測試個案')
        : undefined;
    expect(item).toBeDefined();
    expect(item?.summary.kind).toBe('allFn');
    expect(item?.lastAssessedAt).toBeTruthy();
    stop();
  });
});
