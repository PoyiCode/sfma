<script setup lang="ts">
// 部位標註表單（04 §4.5 正向連動展示層）：純展示、自管草稿；findingType／關聯動作／備註→submit 上拋草稿。
// 部位本身（anatomyId/side）與 annotationId 由容器補入。
import { ref } from 'vue';
import type { BodyAnnotation, Side, SfmaPatternDefinition, SfmaPatternKey } from '@ptapp/shared';
import UiButton from '../ui/Button.vue';
import UiInput from '../ui/Input.vue';
import UiSegmentedControl, { type SegmentedOption } from '../ui/SegmentedControl.vue';
import UiSelect, { type SelectOption } from '../ui/Select.vue';
import type { BodyAnnotationFindingType } from '../../utils/assessment/bodyAnnotationForm';
import { FINDING_TYPES, FINDING_TYPE_LABEL_KEY } from '../../utils/humanModel/interact/findingTypeLabel';
import { localizeText } from '../../utils/i18n/localizeText';

// 表單回傳草稿：部位 anatomyId／annotationId 由容器補入；side 由表單（成對部位可改、預填點選側）。
export type BodyAnnotationDraft = Pick<
  BodyAnnotation,
  'findingType' | 'linkedPatternKey' | 'note'
> & {
  side?: Side;
};

interface Props {
  patterns: readonly SfmaPatternDefinition[];
  // 選填：編輯既有標註時帶入起始值（未提供＝新增，預設 painful＋首個動作）。
  initial?: BodyAnnotationDraft;
  // 選填：新增模式之關聯動作預設（如 finding→模型深連結帶入之 patternKey）；`initial` 優先。
  defaultLinkedPatternKey?: SfmaPatternKey;
  // 側別（取消左右群組化）：成對部位顯左/右分段（預填點選側 defaultSide、可改）；中線 sided=false 不顯。
  sided?: boolean;
  defaultSide?: Side;
  // 休眠慣例（對應 ptApp onRemove）：true＝編輯既有標註，顯「移除標註」（danger）並發 remove 事件。
  canRemove?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  initial: undefined,
  defaultLinkedPatternKey: undefined,
  sided: false,
  defaultSide: null,
  canRemove: false,
});

const emit = defineEmits<{
  submit: [draft: BodyAnnotationDraft];
  cancel: [];
  remove: [];
}>();

const { t } = useI18n();

const findingType = ref<BodyAnnotationFindingType>(props.initial?.findingType ?? 'painful');
// 側別（成對部位）：預填點選之側（編輯時用既有 initial.side）、可改；中線 sided=false 不顯。
const side = ref<Side>(props.initial?.side ?? props.defaultSide ?? null);
const linkedPatternKey = ref<SfmaPatternKey>(
  props.initial?.linkedPatternKey ??
    props.defaultLinkedPatternKey ??
    props.patterns[0]!.patternKey,
);
const note = ref(props.initial?.note ?? '');

const findingOptions: SegmentedOption[] = FINDING_TYPES.map((value) => ({
  value,
  label: t(FINDING_TYPE_LABEL_KEY[value]),
}));
const sideOptions: SegmentedOption[] = [
  { value: 'left', label: t('assessmentSideLeft') },
  { value: 'right', label: t('assessmentSideRight') },
];
const patternOptions: SelectOption[] = props.patterns.map((pattern) => ({
  value: pattern.patternKey,
  label: localizeText(pattern.name),
}));

// 變更處理函式（避免模板內聯 TS `as` 轉型——執行期模板編譯器不剝除型別語法）。
function onFindingType(value: string): void {
  findingType.value = value as BodyAnnotationFindingType;
}
function onSide(value: string): void {
  side.value = value as Side;
}
function onPattern(value: string | undefined): void {
  if (value !== undefined) linkedPatternKey.value = value as SfmaPatternKey;
}

function handleSubmit(): void {
  emit('submit', {
    findingType: findingType.value,
    linkedPatternKey: linkedPatternKey.value,
    note: note.value.trim(),
    side: side.value,
  });
}
</script>

<template>
  <form class="bodyAnnotationForm" @submit.prevent="handleSubmit">
    <div class="bodyAnnotationField">
      <span class="bodyAnnotationFieldLabel">{{ t('bodyAnnotationFindingTypeLabel') }}</span>
      <UiSegmentedControl
        v-bind="{ ariaLabel: t('bodyAnnotationFindingTypeLabel') }"
        :model-value="String(findingType)"
        :options="findingOptions"
        @update:model-value="onFindingType"
      />
    </div>
    <div v-if="sided" class="bodyAnnotationField">
      <span class="bodyAnnotationFieldLabel">{{ t('assessmentSide') }}</span>
      <UiSegmentedControl
        v-bind="{ ariaLabel: t('assessmentSide') }"
        :model-value="String(side ?? 'left')"
        :options="sideOptions"
        @update:model-value="onSide"
      />
    </div>
    <div class="bodyAnnotationField">
      <span class="bodyAnnotationFieldLabel">{{ t('bodyAnnotationPatternLabel') }}</span>
      <UiSelect
        v-bind="{ ariaLabel: t('bodyAnnotationPatternLabel') }"
        :model-value="String(linkedPatternKey)"
        :options="patternOptions"
        @update:model-value="onPattern"
      />
    </div>
    <div class="bodyAnnotationField">
      <span class="bodyAnnotationFieldLabel">{{ t('bodyAnnotationNoteLabel') }}</span>
      <UiInput
        v-model="note"
        :aria-label="t('bodyAnnotationNoteLabel')"
        :placeholder="t('bodyAnnotationNotePlaceholder')"
      />
    </div>
    <div class="bodyAnnotationActions">
      <UiButton
        v-if="canRemove"
        type="button"
        variant="danger"
        class="bodyAnnotationRemoveButton"
        @click="emit('remove')"
      >
        {{ t('bodyAnnotationRemove') }}
      </UiButton>
      <UiButton type="button" variant="secondary" @click="emit('cancel')">
        {{ t('bodyAnnotationCancel') }}
      </UiButton>
      <UiButton type="submit" variant="primary">
        {{ initial ? t('bodyAnnotationSave') : t('bodyAnnotationSubmit') }}
      </UiButton>
    </div>
  </form>
</template>

<style scoped>
.bodyAnnotationForm {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.bodyAnnotationField {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.bodyAnnotationFieldLabel {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.bodyAnnotationActions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.bodyAnnotationRemoveButton {
  margin-inline-end: auto;
}
</style>
