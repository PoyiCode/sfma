// 模型標註連動評估 Nuxt 整合測試（todo 08 主流程 §4.5 model↔assessment 接縫；對等 ptApp annotationFlow.test.tsx）。
//
// 取捨（環境受限——詳見回報）：模型頁（model.vue）渲染需 WebGL／canvas，jsdom 不可建；ptApp 對應測試
// 即 mock detectDeviceCapability＋Model3DViewer 樁。本機 @nuxt/test-utils 頁渲染又不穩，故以「真實
// useAssessmentSession 讀取＋bodyAnnotationForm 純函式＋真實 localStore＋fake-indexeddb」於 Nuxt runtime
// context 直驅「選部位 → 建標註 → 落盤 session.bodyAnnotations → 標註清單入列 ＋ 反向高亮衍生
//（annotationHighlights）」之 §4.5 連貫接縫（forward write＋reverse highlight；孤立單元測各自打樁、
// 看不到此跨層連貫）。真實 3D 選取／反向高亮像素級行為留待 Playwright E2E／實機。
import { afterEach, describe, expect, it } from 'vitest';
import { effectScope } from 'vue';
import { waitFor } from '@testing-library/vue';
import { localStore } from './utils/data/localStore';
import { newAssessmentSession } from './utils/assessment/assessmentSession';
import { useAssessmentSession } from './composables/assessment/useAssessmentSession';
import { newBodyAnnotation, upsertBodyAnnotation } from './utils/assessment/bodyAnnotationForm';
import { annotationHighlights } from './utils/humanModel/anatomy/anatomyHighlight';
import { partKey } from './utils/humanModel/anatomy/partKey';
import { createUuid, toIsoDateTime } from '@ptapp/shared';

afterEach(async () => {
  const patients = await localStore.listPatients();
  for (const patient of patients) await localStore.deletePatient(patient.patientId);
});

describe('模型標註連動評估整合（§4.5 真實 composable＋localStore＋fake-indexeddb，Nuxt runtime）', () => {
  it('選部位（肱二頭肌）→ 加標註 painful → 落盤 session.bodyAnnotations → 清單入列＋反向高亮衍生（select→form→save→list/highlight 接縫）', async () => {
    const patient = await localStore.createPatient({
      name: '模型標註個案',
      consentAcknowledgedAt: '2026-06-16T09:00:00+08:00',
    });
    const session = newAssessmentSession(
      createUuid(),
      patient.patientId,
      { assessorId: createUuid(), name: '' },
      toIsoDateTime(new Date()),
    );
    await localStore.saveAssessment(session);
    expect(session.bodyAnnotations).toHaveLength(0);

    // 模型頁載入此 session：useAssessmentSession 讀取（反向高亮以 session.bodyAnnotations 衍生）。
    const scope = effectScope();
    const api = scope.run(() => useAssessmentSession(session.sessionId, localStore))!;
    await waitFor(() => expect(api.state.value.status).toBe('ready'));
    const ready = api.state.value;
    if (ready.status !== 'ready') throw new Error('session not ready');
    // 初始空態：尚無標註 → 反向高亮為空。
    expect(annotationHighlights(ready.session.bodyAnnotations).size).toBe(0);

    // 選部位（3D 上拋 partKey）→ 標註 Dialog 預設 painful＋首動作 → 送出：建標註（純函式）。
    const annotation = newBodyAnnotation(
      createUuid(),
      'muscle.bicepsBrachii',
      null,
      'painful',
      'cervicalFlexion',
    );
    // 落盤 session.bodyAnnotations。注意：ready.session 為 Vue reactive proxy，IndexedDB 之結構化
    // 複製不接受 proxy（DataCloneError）→ 先 deep-clone 為純資料再寫（session 為純可序列化資料）。
    const plain = JSON.parse(JSON.stringify(ready.session)) as typeof ready.session;
    const next = {
      ...plain,
      bodyAnnotations: upsertBodyAnnotation(plain.bodyAnnotations, annotation),
    };
    await localStore.saveAssessment(next);

    // (a) 落盤驗證：session.bodyAnnotations 收錄該標註（部位／findingType 正確）。
    const saved = await localStore.getAssessment(session.sessionId);
    expect(saved).toBeDefined();
    const savedAnnotations = saved!.bodyAnnotations;
    expect(savedAnnotations).toHaveLength(1);
    expect(savedAnnotations[0]!.anatomyId).toBe('muscle.bicepsBrachii');
    expect(savedAnnotations[0]!.findingType).toBe('painful');

    // (b) 反向高亮衍生（annotationHighlights）：該部位 key 高亮為 painful（model 反向高亮唯一真相）。
    const highlights = annotationHighlights(saved!.bodyAnnotations);
    expect(highlights.get(partKey('muscle.bicepsBrachii', null))).toBe('painful');

    // (c) composable reload：標註清單來源（session.bodyAnnotations）重載後仍含該標註（清單入列接縫）。
    api.reload();
    await waitFor(() => {
      const reloaded = api.state.value;
      expect(reloaded.status === 'ready' && reloaded.session.bodyAnnotations.length).toBe(1);
    });
    scope.stop();
  });
});
