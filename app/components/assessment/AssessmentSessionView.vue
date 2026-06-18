<script setup lang="ts">
// 評估表清單（03 §3.3.9）：10 大動作各為一手風琴列。列頭顯動作名＋各側「已判讀」StatusChip 概況
// （未判讀不顯）；展開為各側 AssessmentEntryCard（雙側左右、單一一筆）。受控：卡片變更上拋 recordChange，
// 由容器經 useAssessmentSession.updateRecord 落盤（樂觀更新→saveAssessment 重算 summary）。
import { computed } from 'vue';
import type { AssessmentSession, PatternRecord, Side, SfmaPatternKey } from '@ptapp/shared';
import UiAccordion, { type AccordionItemData } from '../ui/Accordion.vue';
import UiStatusChip from '../ui/StatusChip.vue';
import AssessmentEntryCard from './AssessmentEntryCard.vue';
import {
  emptyRecord,
  entryClassification,
  entryId,
  findRecord,
  groupAssessmentEntries,
  type AssessmentEntry,
} from '../../utils/assessment/assessmentForm';
import type { FlowMap } from '../../utils/assessment/breakoutFlow/engine';
import { breakoutFlowMap, findBreakout } from '../../utils/assessment/breakoutForm';
import { breakoutEntrySummary } from '../../utils/assessment/breakoutPresentation';
import { localizeText } from '../../utils/i18n/localizeText';

interface Props {
  session: AssessmentSession;
  entries: AssessmentEntry[];
  // DN／DP 每側卡開 Breakout 疊層（03 §3.3.9 實作註）；未啟用則卡不顯入口。
  breakoutEnabled?: boolean;
  // finding 級「標到模型」深連結建構（容器帶 patientId／sessionId）；未提供則卡不顯捷徑。§3.3.8。
  buildModelHref?: (patternKey: SfmaPatternKey) => string;
  // marker→finding 反向（§3.3.8）：載入即展開之動作列（自模型「回到評估發現」深連結 ?pattern= 帶入）。
  defaultOpenPattern?: SfmaPatternKey;
  // DI：完成列徽章以 breakoutEntrySummary 算（預設真實流程圖；測試注入 fake 流程）。
  breakoutFlows?: FlowMap;
}

const props = withDefaults(defineProps<Props>(), {
  breakoutEnabled: false,
  buildModelHref: undefined,
  defaultOpenPattern: undefined,
  breakoutFlows: () => breakoutFlowMap,
});

const emit = defineEmits<{
  recordChange: [record: PatternRecord];
  openBreakout: [patternKey: SfmaPatternKey, side: Side];
}>();

const groups = computed(() => groupAssessmentEntries(props.entries));
const items = computed<AccordionItemData[]>(() =>
  groups.value.map((group) => ({
    value: group.patternKey,
    trigger: localizeText(group.definition.name),
  })),
);
const defaultValue = computed(() =>
  props.defaultOpenPattern ? [props.defaultOpenPattern] : undefined,
);

function recordFor(entry: AssessmentEntry): PatternRecord {
  return (
    findRecord(props.session.patterns, entry.patternKey, entry.side) ??
    emptyRecord(entry.patternKey, entry.side)
  );
}

function chipRecord(entry: AssessmentEntry): PatternRecord | undefined {
  return findRecord(props.session.patterns, entry.patternKey, entry.side);
}

function summaryFor(entry: AssessmentEntry) {
  return breakoutEntrySummary(
    findBreakout(props.session.breakouts, entry.patternKey, entry.side),
    props.breakoutFlows,
  );
}
</script>

<template>
  <UiAccordion
    :items="items"
    class="assessmentSessionView"
    :default-value="defaultValue"
  >
    <template v-for="group in groups" #[`trigger-${group.patternKey}`] :key="`t-${group.patternKey}`">
      <span class="assessmentRowHead">
        <span class="assessmentRowName">{{ localizeText(group.definition.name) }}</span>
        <span class="assessmentRowChips">
          <template v-for="entry in group.entries" :key="entryId(entry.patternKey, entry.side)">
            <UiStatusChip
              v-if="chipRecord(entry)"
              :status="entryClassification(chipRecord(entry)!)"
            />
          </template>
        </span>
      </span>
    </template>
    <template v-for="group in groups" #[group.patternKey] :key="`c-${group.patternKey}`">
      <div class="assessmentSides" :data-sides="group.entries.length">
        <AssessmentEntryCard
          v-for="entry in group.entries"
          :key="entryId(entry.patternKey, entry.side)"
          :entry="entry"
          :record="recordFor(entry)"
          :breakout-enabled="breakoutEnabled"
          :breakout-summary="summaryFor(entry)"
          :model-href="buildModelHref ? buildModelHref(entry.patternKey) : undefined"
          @change="emit('recordChange', $event)"
          @open-breakout="emit('openBreakout', entry.patternKey, entry.side)"
        />
      </div>
    </template>
  </UiAccordion>
</template>

<style scoped>
/* 評估表列頭與各側並排（03 §3.3.9、§3.7）。 */
.assessmentRowHead {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.assessmentRowName {
  font-weight: 500;
}

.assessmentRowChips {
  display: inline-flex;
  gap: var(--space-1);
}

.assessmentSides {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3) 0;
}

.assessmentSides[data-sides='2'] {
  grid-template-columns: 1fr 1fr;
}

@media (max-width: 600px) {
  .assessmentSides[data-sides='2'] {
    grid-template-columns: 1fr;
  }
}
</style>
