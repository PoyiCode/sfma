<script setup lang="ts">
// 標註管理列表（04 §4.5 (b)）：純展示某評估全部 bodyAnnotation；逐筆瀏覽／跳至部位／移除。
// 關聯動作名以 patternKey→本地化名 Map 解析（definitions 無 byKey map，於此就地建）。
import { computed } from 'vue';
import type { BodyAnnotation, SfmaPatternDefinition, SfmaPatternKey } from '@ptapp/shared';
import UiButton from '../ui/Button.vue';
import { anatomyDisplayName } from '../../utils/humanModel/anatomy/anatomyInfo';
import { partKey } from '../../utils/humanModel/anatomy/partKey';
import { FINDING_TYPE_LABEL_KEY } from '../../utils/humanModel/interact/findingTypeLabel';
import { localizeText } from '../../utils/i18n/localizeText';

interface Props {
  annotations: readonly BodyAnnotation[];
  patterns: readonly SfmaPatternDefinition[];
  // 目前選取之 partKey（取消左右群組化）：標記對應列（左右各自）。
  selectedAnatomyId?: string | null;
  // 休眠慣例（對應 ptApp onSelect/onRemove）：true 才可跳至部位／快速移除。
  canSelect?: boolean;
  canRemove?: boolean;
  // marker→finding 反向（§3.3.8）：建構「回到評估發現」深連結（帶 linkedPatternKey）；未提供則不顯。
  buildFindingHref?: (linkedPatternKey: SfmaPatternKey) => string;
}

const props = withDefaults(defineProps<Props>(), {
  selectedAnatomyId: null,
  canSelect: false,
  canRemove: false,
  buildFindingHref: undefined,
});

const emit = defineEmits<{ select: [partKey: string]; remove: [annotationId: string] }>();

const { t } = useI18n();

const patternNameByKey = computed(() => {
  const map = new Map<SfmaPatternKey, string>();
  for (const pattern of props.patterns) {
    map.set(pattern.patternKey, localizeText(pattern.name));
  }
  return map;
});

// 列檢視模型（partKey、選取態、側別後綴、顯示名等），避免模板重複計算。
const rows = computed(() =>
  props.annotations.map((annotation) => {
    const annotationKey = partKey(annotation.anatomyId, annotation.side);
    const sideSuffix =
      annotation.side === 'left'
        ? `（${t('assessmentSideLeft')}）`
        : annotation.side === 'right'
          ? `（${t('assessmentSideRight')}）`
          : '';
    return {
      annotation,
      annotationKey,
      isSelected: props.selectedAnatomyId === annotationKey,
      partName: `${anatomyDisplayName(annotation.anatomyId)}${sideSuffix}`,
      findingText: t(FINDING_TYPE_LABEL_KEY[annotation.findingType]),
      patternName:
        patternNameByKey.value.get(annotation.linkedPatternKey) ?? annotation.linkedPatternKey,
    };
  }),
);
</script>

<template>
  <section class="bodyAnnotationList" :aria-label="t('bodyAnnotationListTitle')">
    <h2 class="bodyAnnotationListTitle">{{ t('bodyAnnotationListTitle') }}</h2>
    <p v-if="rows.length === 0" class="bodyAnnotationListEmpty">
      {{ t('bodyAnnotationListEmpty') }}
    </p>
    <ul v-else class="bodyAnnotationListRows">
      <li v-for="row in rows" :key="row.annotation.annotationId" class="bodyAnnotationListRow">
        <button
          type="button"
          class="bodyAnnotationListRowMain"
          :aria-current="row.isSelected ? 'true' : undefined"
          :disabled="!canSelect"
          @click="canSelect ? emit('select', row.annotationKey) : undefined"
        >
          <span class="bodyAnnotationListPart">{{ row.partName }}</span>
          <span class="bodyAnnotationListMeta">
            <span class="bodyAnnotationListFinding">{{ row.findingText }}</span>
            <span class="bodyAnnotationListPattern">{{ row.patternName }}</span>
          </span>
          <span v-if="row.annotation.note" class="bodyAnnotationListNote">
            {{ row.annotation.note }}
          </span>
        </button>
        <NuxtLink
          v-if="buildFindingHref"
          class="button"
          data-variant="ghost"
          :to="buildFindingHref(row.annotation.linkedPatternKey)"
        >
          {{ t('backToFinding') }}
        </NuxtLink>
        <UiButton
          v-if="canRemove"
          type="button"
          variant="ghost"
          :aria-label="t('bodyAnnotationRemove')"
          @click="emit('remove', row.annotation.annotationId)"
        >
          {{ t('bodyAnnotationRemove') }}
        </UiButton>
      </li>
    </ul>
  </section>
</template>

<style scoped>
/* 標註管理列表（04 §4.5 (b)）；顏色取 semantic token。 */
.bodyAnnotationList {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.bodyAnnotationListTitle {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 500;
}

.bodyAnnotationListEmpty {
  margin: 0;
  color: var(--color-text-muted);
}

.bodyAnnotationListRows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.bodyAnnotationListRow {
  display: flex;
  align-items: stretch;
  gap: var(--space-2);
}

.bodyAnnotationListRowMain {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  text-align: start;
  cursor: pointer;
}

.bodyAnnotationListRowMain:disabled {
  cursor: default;
}

.bodyAnnotationListRowMain[aria-current='true'] {
  border-color: var(--color-accent);
}

.bodyAnnotationListPart {
  font-weight: 500;
}

.bodyAnnotationListMeta {
  display: inline-flex;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.bodyAnnotationListNote {
  font-size: var(--font-size-sm);
}
</style>
