<script setup lang="ts">
// Breakout 疊層容器（03 §3.3.9 line 152）：斷點決定版面——Compact/Medium 全屏 sheet、
// Expanded 右側欄（420–480px）與評估表並存。掛載即開啟：useHistoryDismiss 推 history entry，
// 系統返回／× 鈕＝收合整層（close，不破壞 §3.3.5）。受控：record 由上層 session 持有，
// 每步經 useBreakout→change 樂觀落盤。flows 可注入供測試脫鉤（預設 16 真實流程）。
import { computed, toRef } from 'vue';
import type { BreakoutRecord, LocalizedText } from '@ptapp/shared';
import { sfmaPatternByKey } from '@ptapp/definitions';
import { useBreakpoint } from '../../composables/app/useBreakpoint';
import { useHistoryDismiss } from '../../composables/app/useHistoryDismiss';
import { useBreakout } from '../../composables/assessment/useBreakout';
import type { FlowMap } from '../../utils/assessment/breakoutFlow/engine';
import { breakoutFlowMap } from '../../utils/assessment/breakoutForm';
import BreakoutOverlayView from './BreakoutOverlayView.vue';

// flowName 理論上恆有值（入口流程必在 flow map）；此為型別安全後備、正常不顯。
const UNKNOWN_FLOW_NAME: LocalizedText = { 'zh-TW': '', en: '' };

interface Props {
  record: BreakoutRecord;
  flows?: FlowMap;
  // 同 pattern 另一側紀錄（雙側用）：供不分側測試帶入前值（05 §5.3.3 #8）。
  otherSideRecord?: BreakoutRecord;
}

const props = withDefaults(defineProps<Props>(), {
  flows: () => breakoutFlowMap,
  otherSideRecord: undefined,
});

const emit = defineEmits<{ change: [record: BreakoutRecord]; close: [] }>();

const breakpoint = useBreakpoint();
const dismiss = useHistoryDismiss(() => emit('close'));

const breakout = useBreakout(
  toRef(props, 'record'),
  (record) => emit('change', record),
  props.flows,
  toRef(props, 'otherSideRecord'),
);

const variant = computed(() => (breakpoint.value === 'expanded' ? 'panel' : 'sheet'));
const flowName = computed(() => breakout.flowName.value ?? UNKNOWN_FLOW_NAME);
// 來源頂層動作名稱（供頂條動作參考圖之 alt）；理論上恆有值，型別安全後備為空。
const patternName = computed(
  () => sfmaPatternByKey.get(props.record.patternKey)?.name ?? UNKNOWN_FLOW_NAME,
);
const freeformControls = computed(() => ({
  active: breakout.freeform.value,
  flowOptions: breakout.flowOptions.value,
  nodeOptions: breakout.nodeOptions.value,
  pickedFlowKey: breakout.pickedFlowKey.value,
  pickedNodeKey: breakout.pickedNodeKey.value,
  node: breakout.freeformNode.value,
}));
</script>

<template>
  <div
    class="breakoutOverlayChrome"
    :data-variant="variant"
    role="dialog"
    :aria-modal="variant === 'sheet'"
  >
    <BreakoutOverlayView
      :flow-name="flowName"
      :pattern-key="record.patternKey"
      :pattern-name="patternName"
      :step-count="breakout.stepCount.value"
      :node="breakout.node.value"
      :prior-result="breakout.priorResult.value"
      :result-cards="breakout.resultCards.value"
      :findings="breakout.findings.value"
      :queued-flow-names="breakout.queuedFlowNames.value"
      :step-views="breakout.stepViews.value"
      :rewind-preview="breakout.rewindPreview"
      :classification="breakout.classification.value"
      :classification-overridden="breakout.isClassificationOverridden.value"
      :freeform="freeformControls"
      :manual-choice-candidates="breakout.manualChoiceCandidates.value"
      @rewind="breakout.rewind"
      @classification-change="breakout.setClassification"
      @toggle-freeform="breakout.setFreeform"
      @pick-flow="breakout.setPickedFlow"
      @pick-node="breakout.setPickedNode"
      @freeform-result="breakout.applyFreeform"
      @resolve-manual-choice="breakout.resolveManualChoice"
      @cancel-manual-choice="breakout.cancelManualChoice"
      @result="breakout.applyResult"
      @close="dismiss"
    />
  </div>
</template>

<style scoped>
/* Breakout 疊層容器（03 §3.3.9 line 152）：Compact/Medium 全屏 sheet、Expanded 右側欄並存。 */
.breakoutOverlayChrome {
  position: fixed;
  z-index: 50;
  display: flex;
  flex-direction: column;
}

.breakoutOverlayChrome[data-variant='sheet'] {
  inset: 0;
}

.breakoutOverlayChrome[data-variant='panel'] {
  top: 0;
  right: 0;
  bottom: 0;
  width: clamp(420px, 33vw, 480px);
  border-left: 1px solid var(--color-border);
  box-shadow: -4px 0 16px rgb(0 0 0 / 0.12);
}

.breakoutOverlayChrome > :deep(.breakoutOverlay) {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
