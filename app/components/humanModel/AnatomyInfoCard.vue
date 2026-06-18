<script setup lang="ts">
// 部位資訊卡（2D／3D 共用，§4.1 部位選取）。純展示；渲染 describeAnatomyEntity 描述子。
import { computed } from 'vue';
import type { AnatomyEntity } from '@ptapp/shared';
import UiButton from '../ui/Button.vue';
import { describeAnatomyEntity } from '../../utils/humanModel/anatomy/anatomyInfo';
import type { AnatomySide } from '../../utils/humanModel/anatomy/partKey';

interface Props {
  entity: AnatomyEntity;
  // 選填：選取部位之側別（取消左右群組化）：成對部位於名稱併「（左/右）」；中線/未提供則無。
  side?: AnatomySide | null;
  // 休眠慣例（對應 ptApp onAnnotate/onHide）：true 才顯對應入口鈕、發對應事件。
  canAnnotate?: boolean;
  canHide?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  side: null,
  canAnnotate: false,
  canHide: false,
});

const emit = defineEmits<{ annotate: []; hide: [] }>();

const { t } = useI18n();

const info = computed(() => describeAnatomyEntity(props.entity, t));
const sideSuffix = computed(() =>
  props.side === 'left'
    ? `（${t('assessmentSideLeft')}）`
    : props.side === 'right'
      ? `（${t('assessmentSideRight')}）`
      : '',
);
</script>

<template>
  <article class="anatomyInfoCard">
    <header class="anatomyInfoCardHeader">
      <h3 class="anatomyInfoCardName">{{ `${info.name}${sideSuffix}` }}</h3>
      <span class="anatomyInfoCardType">{{ info.typeLabel }}</span>
    </header>
    <dl v-if="info.rows.length > 0" class="anatomyInfoCardRows">
      <div v-for="row in info.rows" :key="row.label" class="anatomyInfoCardRow">
        <dt class="anatomyInfoCardRowLabel">{{ row.label }}</dt>
        <dd class="anatomyInfoCardRowValue">{{ row.value }}</dd>
      </div>
    </dl>
    <UiButton v-if="canAnnotate" variant="secondary" @click="emit('annotate')">
      {{ t('anatomyAnnotate') }}
    </UiButton>
    <UiButton v-if="canHide" variant="ghost" @click="emit('hide')">
      {{ t('anatomyHide') }}
    </UiButton>
  </article>
</template>

<style scoped>
.anatomyInfoCard {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  padding: var(--space-4);
}

.anatomyInfoCardHeader {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.anatomyInfoCardName {
  margin: 0;
  font-size: var(--font-size-lg);
}

.anatomyInfoCardType {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 0 var(--space-2);
}

.anatomyInfoCardRows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
}

.anatomyInfoCardRow {
  display: flex;
  gap: var(--space-3);
}

.anatomyInfoCardRowLabel {
  flex: 0 0 6rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.anatomyInfoCardRowValue {
  flex: 1;
  margin: 0;
  font-size: var(--font-size-sm);
}
</style>
