<script setup lang="ts">
// Breakout 疊層三區（03 §3.3.9）：頂條（流程名·已測步數·收合）／中段（端點結果卡＋步進卡）／底摺疊條
// （發現·待測流程）。純展示——結果上拋 result、收合上拋 close；自動前進與引擎呼叫由上層 composable 負責。
import { computed, ref } from 'vue';
import type { BreakoutFindingType, BreakoutNode, LocalizedText, SfmaFlowKey } from '@ptapp/shared';
import BaseAlertDialog from '../base/AlertDialog.vue';
import BaseButton from '../base/Button.vue';
import BaseIconButton from '../base/IconButton.vue';
import BreakoutStepCard from './BreakoutStepCard.vue';
import BreakoutStepList from './BreakoutStepList.vue';
import BreakoutCompletionCard from './BreakoutCompletionCard.vue';
import BreakoutFreeformPicker from './BreakoutFreeformPicker.vue';
import BreakoutManualChoiceCard from './BreakoutManualChoiceCard.vue';
import BreakoutResultCard from './BreakoutResultCard.vue';
import BreakoutFindingsBar from './BreakoutFindingsBar.vue';
import type {
  BreakoutCandidateView,
  BreakoutFindingView,
  BreakoutFlowOption,
  BreakoutNodeOption,
  BreakoutResultCardModel,
  BreakoutStepView,
} from '../../utils/assessment/breakoutPresentation';
import { localizeText } from '../../utils/i18n/localizeText';

// 自由模式控制（06-F2g-iii）：picker 欄位＋啟用旗標，由上層 useBreakout 映入。
export interface BreakoutFreeformControls {
  active: boolean;
  flowOptions: BreakoutFlowOption[];
  nodeOptions: BreakoutNodeOption[];
  pickedFlowKey: SfmaFlowKey | undefined;
  pickedNodeKey: string | undefined;
  node: BreakoutNode | undefined;
}

interface Props {
  flowName: LocalizedText;
  stepCount: number;
  node: BreakoutNode | undefined;
  // 不分側測試另一側前值（05 §5.3.3 #8）；傳入步進卡顯「沿用前值」。
  priorResult?: string;
  resultCards: BreakoutResultCardModel[];
  findings: BreakoutFindingView[];
  queuedFlowNames: LocalizedText[];
  stepViews: BreakoutStepView[];
  rewindPreview: (stepIndex: number) => { invalidatedSteps: number; invalidatedFindings: number };
  classification: BreakoutFindingType | undefined;
  classificationOverridden: boolean;
  freeform: BreakoutFreeformControls;
  manualChoiceCandidates: BreakoutCandidateView[];
}

const props = withDefaults(defineProps<Props>(), { priorResult: undefined });

const emit = defineEmits<{
  rewind: [stepIndex: number];
  classificationChange: [classification: BreakoutFindingType];
  toggleFreeform: [on: boolean];
  pickFlow: [flowKey: SfmaFlowKey];
  pickNode: [nodeKey: string];
  freeformResult: [result: string];
  resolveManualChoice: [branchIndex: number];
  cancelManualChoice: [];
  result: [result: string];
  close: [];
}>();

const { t } = useI18n();

const stepsExpanded = ref(false);
// 待量化確認的作廢步索引（null＝無待決）；破壞性作廢只經此 AlertDialog 觸發（§3.3.5）。
const pendingRewind = ref<number | null>(null);

const rewindDialogOpen = computed({
  get: () => pendingRewind.value !== null,
  set: (open: boolean) => {
    if (!open) pendingRewind.value = null;
  },
});

const rewindMessage = computed(() => {
  if (pendingRewind.value === null) return undefined;
  const preview = props.rewindPreview(pendingRewind.value);
  return t('breakoutRewindConfirm')
    .replace('{steps}', String(preview.invalidatedSteps))
    .replace('{findings}', String(preview.invalidatedFindings));
});

function confirmRewind(): void {
  if (pendingRewind.value !== null) emit('rewind', pendingRewind.value);
}
</script>

<template>
  <div class="breakoutOverlay">
    <header class="breakoutOverlayTop">
      <div class="breakoutOverlayHeading">
        <h2 class="breakoutOverlayFlowName">{{ localizeText(flowName) }}</h2>
        <button
          type="button"
          class="breakoutOverlayBreadcrumb"
          :aria-expanded="stepsExpanded"
          @click="stepsExpanded = !stepsExpanded"
        >
          {{ `${t('breakoutStepsLabel')} ${stepCount}` }}
        </button>
      </div>
      <div class="breakoutOverlayTopActions">
        <BaseButton
          variant="ghost"
          class="breakoutFreeformToggle"
          :aria-pressed="freeform.active"
          @click="emit('toggleFreeform', !freeform.active)"
        >
          {{ t('breakoutFreeform') }}
        </BaseButton>
        <BaseIconButton :label="t('breakoutClose')" icon="×" @click="emit('close')" />
      </div>
    </header>
    <div v-if="stepsExpanded" class="breakoutStepListPanel">
      <BreakoutStepList :steps="stepViews" rewindable @rewind-step="pendingRewind = $event" />
      <BaseButton
        v-if="stepCount > 0"
        variant="ghost"
        class="breakoutStepBack"
        @click="pendingRewind = stepCount - 1"
      >
        <span aria-hidden="true">⤺ </span>
        {{ t('breakoutStepBack') }}
      </BaseButton>
    </div>
    <div class="breakoutOverlayBody">
      <div v-if="resultCards.length > 0" class="breakoutOverlayResults">
        <BreakoutResultCard
          v-for="(card, index) in resultCards"
          :key="`${card.kind}-${index}`"
          :model="card"
        />
      </div>
      <BreakoutManualChoiceCard
        v-if="manualChoiceCandidates.length > 0"
        :candidates="manualChoiceCandidates"
        @choose="emit('resolveManualChoice', $event)"
        @cancel="emit('cancelManualChoice')"
      />
      <BreakoutFreeformPicker
        v-else-if="freeform.active"
        :flow-options="freeform.flowOptions"
        :node-options="freeform.nodeOptions"
        :picked-flow-key="freeform.pickedFlowKey"
        :picked-node-key="freeform.pickedNodeKey"
        :node="freeform.node"
        @pick-flow="emit('pickFlow', $event)"
        @pick-node="emit('pickNode', $event)"
        @result="emit('freeformResult', $event)"
      />
      <BreakoutStepCard
        v-else-if="node !== undefined"
        :node="node"
        :prior-result="priorResult"
        @result="emit('result', $event)"
      />
      <BreakoutCompletionCard
        v-else
        :classification="classification"
        :overridden="classificationOverridden"
        :findings="findings"
        @classification-change="emit('classificationChange', $event)"
      />
    </div>
    <BreakoutFindingsBar :findings="findings" :queued-flow-names="queuedFlowNames" />
    <BaseAlertDialog
      v-model:open="rewindDialogOpen"
      :title="t('breakoutRewindTitle')"
      :description="rewindMessage"
      :cancel-label="t('breakoutRewindCancel')"
      :action-label="t('breakoutRewindAction')"
      destructive
      @confirm="confirmRewind"
    />
  </div>
</template>

<style scoped>
/* Breakout 疊層三區（03 §3.3.9 line 150–161）：頂條／中段捲動／底摺疊條。 */
.breakoutOverlay {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--color-bg);
}

.breakoutOverlayTop {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.breakoutOverlayFlowName {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.breakoutOverlayHeading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
}

/* 頂條右側動作列（06-F2g-iii）：自由模式切換鈕＋收合鈕並排。 */
.breakoutOverlayTopActions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* breadcrumb：點開為步驟清單（03 §3.3.9 line 159、171）。去原生鈕樣式、沿用 muted 進度字級。 */
.breakoutOverlayBreadcrumb {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.breakoutStepListPanel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.breakoutStepBack {
  align-self: flex-start;
}

.breakoutOverlayBody {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-4);
}

.breakoutOverlayResults {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
