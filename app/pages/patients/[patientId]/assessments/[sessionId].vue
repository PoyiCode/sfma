<script setup lang="ts">
// 評估表容器（03 §3.3.9）：取 sessionId＋useAssessmentSession（loading／notFound／error／ready）；
// ready 時頂部顯進度（已判讀 n/15）＋「完成評估」回紀錄，主體餵 AssessmentSessionView，
// 每次卡片變更經 updateRecord 樂觀落盤（saveAssessment 重算 summary）。DN／DP 每側卡開 Breakout 疊層：
// breakoutTarget 持目標 pattern×side、find-or-create 受控紀錄、change 經 updateBreakout 落盤、返回／× 收合。
import { computed, ref } from 'vue';
import { sfmaPatterns } from '@ptapp/definitions';
import type { Side, SfmaPatternKey } from '@ptapp/shared';
import { useAssessmentSession } from '../../../../composables/assessment/useAssessmentSession';
import { assessmentProgress, buildAssessmentEntries } from '../../../../utils/assessment/assessmentForm';
import {
  findBreakout,
  newBreakoutRecord,
  oppositeSide,
} from '../../../../utils/assessment/breakoutForm';
import AssessmentSessionView from '../../../../components/assessment/AssessmentSessionView.vue';
import AssessmentSummaryView from '../../../../components/assessment/AssessmentSummaryView.vue';
import BreakoutOverlay from '../../../../components/assessment/BreakoutOverlay.vue';
import PageError from '../../../../components/ui/PageError.vue';
import PageSkeleton from '../../../../components/ui/PageSkeleton.vue';

interface BreakoutTarget {
  patternKey: SfmaPatternKey;
  side: Side;
}

const { t } = useI18n();
useHead({ title: () => t('titleAssessmentSession') });

const route = useRoute();
const patientId = computed(() => String(route.params.patientId ?? ''));
const sessionId = computed(() => String(route.params.sessionId ?? ''));

const entries = buildAssessmentEntries(sfmaPatterns);
const { state, updateRecord, updateBreakout, reload } = useAssessmentSession(sessionId);

const breakoutTarget = ref<BreakoutTarget | null>(null);

// marker→finding 反向（§3.3.8）：自模型「回到評估發現」深連結帶 ?pattern=，驗證合法後初始展開該列。
const defaultOpenPattern = computed<SfmaPatternKey | undefined>(() => {
  const raw = route.query.pattern;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value != null && sfmaPatterns.some((pattern) => pattern.patternKey === value)
    ? (value as SfmaPatternKey)
    : undefined;
});

const session = computed(() => (state.value.status === 'ready' ? state.value.session : undefined));
const progress = computed(() =>
  session.value ? assessmentProgress(session.value.patterns, entries) : undefined,
);

// find-or-create 受控 breakout 紀錄。
const breakoutRecord = computed(() => {
  const target = breakoutTarget.value;
  const current = session.value;
  if (!target || !current) return undefined;
  return (
    findBreakout(current.breakouts, target.patternKey, target.side) ??
    newBreakoutRecord(target.patternKey, target.side)
  );
});

// 另一側紀錄（雙側）：供不分側測試（CTSIB 等）帶入前值（05 §5.3.3 #8）。
const otherSideBreakout = computed(() => {
  const target = breakoutTarget.value;
  const current = session.value;
  if (!target || !current) return undefined;
  const other = oppositeSide(target.side);
  return other !== undefined
    ? findBreakout(current.breakouts, target.patternKey, other)
    : undefined;
});

// 重掛 overlay（pattern×side 變更時重置 composable 區域態）：對應 React key。
const overlayKey = computed(() =>
  breakoutTarget.value
    ? `${breakoutTarget.value.patternKey}:${breakoutTarget.value.side ?? 'single'}`
    : '',
);

function openBreakout(patternKey: SfmaPatternKey, side: Side): void {
  breakoutTarget.value = { patternKey, side };
}

function buildModelHref(patternKey: SfmaPatternKey): string {
  return `/patients/${patientId.value}/model?session=${sessionId.value}&pattern=${patternKey}`;
}
</script>

<template>
  <PageSkeleton
    v-if="state.status === 'loading'"
    :label="t('loading')"
    class="assessmentSessionStatus"
  />
  <div v-else-if="state.status === 'notFound'" class="assessmentSessionStatus">
    <p>{{ t('assessmentNotFound') }}</p>
    <NuxtLink
      class="button"
      data-variant="secondary"
      :to="`/patients/${patientId}/assessments`"
    >
      {{ t('backToAssessments') }}
    </NuxtLink>
  </div>
  <PageError
    v-else-if="state.status === 'error'"
    class="assessmentSessionStatus"
    :message="t('assessmentSessionLoadError')"
    :retry-label="t('retry')"
    @retry="reload"
  />
  <div v-else-if="session && progress" class="assessmentSession">
    <div class="assessmentSessionHeader">
      <span class="assessmentSessionProgress">
        {{ `${t('assessmentProgressLabel')} ${progress.assessed}/${progress.total}` }}
      </span>
      <NuxtLink
        class="button"
        data-variant="secondary"
        :to="`/patients/${patientId}/model?session=${sessionId}`"
      >
        {{ t('viewOnModel') }}
      </NuxtLink>
      <NuxtLink class="button" data-variant="primary" :to="`/patients/${patientId}/assessments`">
        {{ t('assessmentComplete') }}
      </NuxtLink>
    </div>
    <AssessmentSessionView
      :session="session"
      :entries="entries"
      breakout-enabled
      :build-model-href="buildModelHref"
      :default-open-pattern="defaultOpenPattern"
      @record-change="updateRecord"
      @open-breakout="openBreakout"
    />
    <AssessmentSummaryView :session="session" :entries="entries" />
    <BreakoutOverlay
      v-if="breakoutTarget && breakoutRecord"
      :key="overlayKey"
      :record="breakoutRecord"
      :other-side-record="otherSideBreakout"
      @change="updateBreakout"
      @close="breakoutTarget = null"
    />
  </div>
</template>

<style scoped>
/* 評估表容器頂部（進度＋完成）與狀態列；token 取 03 §3.7。 */
.assessmentSession {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.assessmentSessionHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.assessmentSessionProgress {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.assessmentSessionStatus {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
