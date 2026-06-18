<script setup lang="ts">
// Breakout 底摺疊條（03 §3.3.9 line 153、161）：摘要「發現 N · 待測流程 M」，點開為 findings 清單
// （findingType chip · 顯示文字 · 來源測試）＋待測流程名。展開狀態為純 UI 局部 state。
import { ref, watch } from 'vue';
import type { LocalizedText } from '@ptapp/shared';
import type { BreakoutFindingView } from '../../utils/assessment/breakoutPresentation';
import { localizeText } from '../../utils/i18n/localizeText';

interface Props {
  findings: BreakoutFindingView[];
  queuedFlowNames: LocalizedText[];
}

const props = defineProps<Props>();

const { t } = useI18n();

const expanded = ref(false);
// 新發現徽章脈動（05 §5.3.3、03 §3.3.9）：findings 數增加（新發現）時短暫脈動引注意；
// 回溯作廢致數減少不脈動。animationend 重置旗標（含 reduced-motion 近零時長亦會觸發）。
const pulsing = ref(false);
watch(
  () => props.findings.length,
  (count, prev) => {
    if (count > prev) pulsing.value = true;
  },
);
</script>

<template>
  <section class="breakoutFindingsBar" :data-expanded="expanded">
    <button
      type="button"
      class="breakoutFindingsBarSummary"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="breakoutFindingsSummary">
        {{ t('breakoutFindingsCount') }}
        <span
          class="breakoutFindingsBadge"
          :data-pulse="pulsing"
          @animationend="pulsing = false"
        >
          {{ findings.length }}
        </span>
        {{ ` · ${t('breakoutQueuedCount')} ${queuedFlowNames.length}` }}
      </span>
    </button>
    <div v-if="expanded" class="breakoutFindingsBarBody">
      <ul v-if="findings.length > 0" class="breakoutFindingsList">
        <li
          v-for="(finding, index) in findings"
          :key="`${finding.findingType}-${index}`"
          class="breakoutFindingItem"
        >
          <span class="breakoutFindingChip" :data-pain="finding.findingType === 'PAIN'">
            {{ finding.findingType }}
          </span>
          <span>{{ localizeText(finding.label) }}</span>
          <span v-if="finding.source !== undefined" class="breakoutFindingSource">
            {{ localizeText(finding.source) }}
          </span>
        </li>
      </ul>
      <ul v-if="queuedFlowNames.length > 0" class="breakoutQueueList">
        <li v-for="(name, index) in queuedFlowNames" :key="`${localizeText(name)}-${index}`">
          {{ localizeText(name) }}
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.breakoutFindingsBar {
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.breakoutFindingsBarSummary {
  display: flex;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: none;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

/* 單一外層 span 保 summary 為按鈕之單一 flex 子（避免多文字節點受 gap 散開）。 */
.breakoutFindingsSummary {
  display: inline;
}

/* 發現計數徽章：新發現加入時脈動引注意（05 §5.3.3）；reduced-motion 由 tokens.css 全域停用。 */
.breakoutFindingsBadge {
  display: inline-block;
  min-width: 1.5em;
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.breakoutFindingsBadge[data-pulse='true'] {
  animation: findingsBadgePulse var(--motion-slow) var(--easing-standard) 2;
}

@keyframes findingsBadgePulse {
  0%,
  100% {
    transform: scale(1);
    background: transparent;
    color: inherit;
  }
  50% {
    transform: scale(1.25);
    background: var(--clinical-finding);
    color: #ffffff;
  }
}

.breakoutFindingsBarBody {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: 0 var(--space-4) var(--space-4);
}

.breakoutFindingsList,
.breakoutQueueList {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.breakoutFindingItem {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.breakoutFindingChip {
  flex: none;
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--clinical-finding);
  color: #ffffff;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.breakoutFindingChip[data-pain='true'] {
  background: var(--color-danger);
}

.breakoutFindingSource {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
