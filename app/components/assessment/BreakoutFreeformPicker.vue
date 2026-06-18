<script setup lang="ts">
// 自由模式挑選器（05 §5.3.3 #9）：流程下拉→節點下拉→挑選節點步進卡（重用 BreakoutStepCard）。
// 純展示：挑選與結果經回呼上拋。未挑流程時流程下拉首列為空值佔位。
import { computed } from 'vue';
import type { BreakoutNode, SfmaFlowKey } from '@ptapp/shared';
import BaseSelect, { type SelectOption } from '../base/Select.vue';
import BreakoutStepCard from './BreakoutStepCard.vue';
import type {
  BreakoutFlowOption,
  BreakoutNodeOption,
} from '../../utils/assessment/breakoutPresentation';
import { localizeText } from '../../utils/i18n/localizeText';

interface Props {
  flowOptions: BreakoutFlowOption[];
  nodeOptions: BreakoutNodeOption[];
  pickedFlowKey: SfmaFlowKey | undefined;
  pickedNodeKey: string | undefined;
  node: BreakoutNode | undefined;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  pickFlow: [flowKey: SfmaFlowKey];
  pickNode: [nodeKey: string];
  result: [result: string];
}>();

const { t } = useI18n();

const flowSelectOptions = computed<SelectOption[]>(() => [
  ...(props.pickedFlowKey === undefined
    ? [{ value: '', label: t('breakoutFreeformPickFlow') }]
    : []),
  ...props.flowOptions.map((option) => ({
    value: option.flowKey,
    label: localizeText(option.name),
  })),
]);
const nodeSelectOptions = computed<SelectOption[]>(() =>
  props.nodeOptions.map((option) => ({
    value: option.nodeKey,
    label: localizeText(option.name),
  })),
);

function onFlowChange(value: string | undefined): void {
  const picked = props.flowOptions.find((option) => option.flowKey === value);
  if (picked !== undefined) emit('pickFlow', picked.flowKey);
}

function onNodeChange(value: string | undefined): void {
  if (value !== undefined && value !== '') emit('pickNode', value);
}
</script>

<template>
  <section class="breakoutFreeform" :aria-label="t('breakoutFreeform')">
    <div class="breakoutFreeformPickers">
      <label class="breakoutFreeformField">
        <span class="breakoutFreeformLabel">{{ t('breakoutFreeformFlow') }}</span>
        <BaseSelect
          v-bind="{ ariaLabel: t('breakoutFreeformFlow') }"
          :options="flowSelectOptions"
          :model-value="pickedFlowKey ?? ''"
          @update:model-value="onFlowChange"
        />
      </label>
      <label v-if="nodeOptions.length > 0" class="breakoutFreeformField">
        <span class="breakoutFreeformLabel">{{ t('breakoutFreeformNode') }}</span>
        <BaseSelect
          v-bind="{ ariaLabel: t('breakoutFreeformNode') }"
          :options="nodeSelectOptions"
          :model-value="pickedNodeKey ?? ''"
          @update:model-value="onNodeChange"
        />
      </label>
    </div>
    <BreakoutStepCard v-if="node !== undefined" :node="node" @result="emit('result', $event)" />
  </section>
</template>

<style scoped>
/* 自由模式挑選器（03 §3.3.9）：流程／節點下拉並排（窄屏堆疊）＋步進卡。 */
.breakoutFreeform {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.breakoutFreeformPickers {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.breakoutFreeformField {
  display: flex;
  flex: 1 1 12rem;
  flex-direction: column;
  gap: var(--space-1);
}

.breakoutFreeformLabel {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
