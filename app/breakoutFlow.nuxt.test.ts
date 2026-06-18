// Breakout 流程 Nuxt 整合測試（todo 08「評估（含 Breakout）」之 jsdom 接縫；對等 ptApp breakoutFlow.test.tsx）。
//
// 取捨（環境受限——詳見回報）：本機（WSL2＋jsdom）下 @nuxt/test-utils renderSuspended 對含 Breakout 疊層
// 之評估表頁渲染不穩；故以「真實 useBreakout 引擎 composable（驅真實 cervicalFlexionBreakout 流程圖）
// ＋真實 localStore＋fake-indexeddb」於 Nuxt runtime context 直驅「DN 評估 → 開 Breakout → 步進結果 →
// 引擎產 finding → 落盤 session.breakouts → AssessmentSummaryView 之 breakoutFindingsOverview 衍生顯示」
// 之連貫接縫（BreakoutOverlayView／useBreakout／engine 孤立單元測各自打樁、看不到此跨層連貫）。
// 真實瀏覽器疊層互動全旅程留待 Playwright E2E。
import { afterEach, describe, expect, it } from 'vitest';
import { effectScope, ref } from 'vue';
import type { BreakoutRecord } from '@ptapp/shared';
import { sfmaPatterns } from '@ptapp/definitions';
import { localStore } from './utils/data/localStore';
import { newAssessmentSession } from './utils/assessment/assessmentSession';
import { useBreakout } from './composables/assessment/useBreakout';
import { newBreakoutRecord, upsertBreakout } from './utils/assessment/breakoutForm';
import { buildAssessmentEntries } from './utils/assessment/assessmentForm';
import {
  breakoutFindingsOverview,
} from './utils/assessment/assessmentSummary';
import { localizeText } from './utils/i18n/localizeText';
import { createUuid, toIsoDateTime } from '@ptapp/shared';

afterEach(async () => {
  const patients = await localStore.listPatients();
  for (const patient of patients) await localStore.deletePatient(patient.patientId);
});

describe('Breakout 流程整合（真實 useBreakout 引擎＋localStore＋fake-indexeddb，Nuxt runtime）', () => {
  it('頸椎屈曲 DN → 開 Breakout → 點 FN → SMCD 發現經引擎產出、落盤 session.breakouts＋總覽衍生顯示（engine→save→overview 接縫）', async () => {
    const patient = await localStore.createPatient({
      name: 'Breakout 流程個案',
      consentAcknowledgedAt: '2026-06-16T09:00:00+08:00',
    });
    const session = newAssessmentSession(
      createUuid(),
      patient.patientId,
      { assessorId: createUuid(), name: '' },
      toIsoDateTime(new Date()),
    );
    await localStore.saveAssessment(session);

    // 受控 Breakout 紀錄（對等容器 find-or-create）：頸椎屈曲（單側）、起始流程 cervicalFlexionBreakout。
    const record = ref<BreakoutRecord>(newBreakoutRecord('cervicalFlexion', null));
    expect(record.value.findings).toHaveLength(0);

    // 真實 useBreakout 引擎驅動：onChange 收引擎輸出之新紀錄（純物件，非 reactive proxy）。
    let persisted: BreakoutRecord | undefined;
    const scope = effectScope();
    const breakout = scope.run(() =>
      useBreakout(
        () => record.value,
        (next) => {
          record.value = next;
          persisted = next;
        },
      ),
    )!;

    // 起始步「主動仰臥頸屈」（activeSupineCervicalFlexion）；點 FN → 一步即終於 SMCD finding。
    breakout.applyResult('FN');

    // (a) 引擎產 SMCD 發現 posturalSmcdCervicalFlexion（findings 僅存 key/type，label 於呈現層反查）。
    expect(persisted).toBeDefined();
    const finding = persisted!.findings.find(
      (item) => item.findingKey === 'posturalSmcdCervicalFlexion',
    );
    expect(finding?.findingType).toBe('SMCD');
    scope.stop();

    // (b) 落盤 session.breakouts（直寫 localStore，避免 reactive proxy 結構化複製限制）→ 持久驗證。
    const nextSession = {
      ...session,
      breakouts: upsertBreakout(session.breakouts, persisted!),
    };
    await localStore.saveAssessment(nextSession);
    const saved = await localStore.getAssessment(session.sessionId);
    const savedFinding = saved?.breakouts
      .flatMap((entry) => entry.findings)
      .find((item) => item.findingKey === 'posturalSmcdCervicalFlexion');
    expect(savedFinding?.findingType).toBe('SMCD');

    // (c) 同頁總覽衍生（breakoutFindingsOverview）：該動作列含 SMCD 發現顯示文字「姿勢性 SMCD 影響頸屈」。
    const entries = buildAssessmentEntries(sfmaPatterns);
    const overview = breakoutFindingsOverview(saved!.breakouts, entries);
    const cervicalRow = overview.find((row) => row.key.startsWith('cervicalFlexion'));
    expect(cervicalRow).toBeDefined();
    const labels = cervicalRow!.findings.map((view) => localizeText(view.label));
    expect(labels.some((label) => label.includes('姿勢性 SMCD 影響頸屈'))).toBe(true);
  });
});
