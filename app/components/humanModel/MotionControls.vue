<script setup lang="ts">
// 運動控制面板（04 §4.3.3）：關節選擇＋逐自由度滑桿（原生 range，min/max＝ROM）＋角度讀數
// ＋觸界提示（非色彩通道：文字 role="status"）＋回中立。受控、狀態由父持（pose／selectedJoint）。
import { computed } from 'vue';
import { anatomyEntityById } from '@ptapp/definitions';
import UiSegmentedControl, { type SegmentedOption } from '../ui/SegmentedControl.vue';
import UiButton from '../ui/Button.vue';
import { localizeText } from '../../utils/i18n/localizeText';
import { clampAngle } from '../../utils/humanModel/motion/romClamp';
import { type MotionPose, jointAngle } from '../../utils/humanModel/motion/motionPose';
import {
  JOINT_KINEMATICS,
  MOVABLE_JOINT_IDS,
  movableJointDof,
} from '../../utils/humanModel/motion/jointKinematics';

const AXIS_LABEL_KEYS: Record<string, string> = {
  flexionExtension: 'motionAxisFlexionExtension',
  abductionAdduction: 'motionAxisAbductionAdduction',
  internalExternalRotation: 'motionAxisInternalExternalRotation',
  plantarDorsiflexion: 'motionAxisPlantarDorsiflexion',
  inversionEversion: 'motionAxisInversionEversion',
  lateralFlexion: 'motionAxisLateralFlexion',
  rotation: 'motionAxisRotation',
};

interface Props {
  pose: MotionPose;
  selectedJoint: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  setJointAngle: [jointId: string, axis: string, deg: number];
  resetPose: [];
  'update:selectedJoint': [jointId: string];
}>();

const { t } = useI18n();

const jointOptions = computed<SegmentedOption[]>(() =>
  MOVABLE_JOINT_IDS.map((id) => ({
    value: id,
    label: localizeText(anatomyEntityById.get(id)?.name ?? { 'zh-TW': id, en: id }),
  })),
);

interface SliderModel {
  axis: string;
  label: string;
  min: number;
  max: number;
  neutral: number;
  value: number;
  atLimit: boolean;
}

const sliders = computed<SliderModel[]>(() => {
  const kin = JOINT_KINEMATICS[props.selectedJoint];
  if (!kin) return [];
  return kin.dofs.map((m) => {
    const dof = movableJointDof(props.selectedJoint, m.axis);
    const min = dof?.min ?? 0;
    const max = dof?.max ?? 0;
    const neutral = dof?.neutral ?? 0;
    const value = jointAngle(props.pose, props.selectedJoint, m.axis, neutral);
    return {
      axis: m.axis,
      label: t(AXIS_LABEL_KEYS[m.axis] ?? m.axis),
      min,
      max,
      neutral,
      value,
      atLimit: value <= min || value >= max,
    };
  });
});

function onJoint(value: string): void {
  if (MOVABLE_JOINT_IDS.includes(value)) emit('update:selectedJoint', value);
}

function onSlider(axis: string, raw: string | number): void {
  const dof = movableJointDof(props.selectedJoint, axis);
  if (!dof) return;
  const { value } = clampAngle(dof, Number(raw));
  emit('setJointAngle', props.selectedJoint, axis, value);
}
</script>

<template>
  <div class="motionControls">
    <UiSegmentedControl
      v-bind="{ ariaLabel: t('modelMotionJoint') }"
      :model-value="selectedJoint"
      :options="jointOptions"
      @update:model-value="onJoint"
    />
    <div v-for="s in sliders" :key="s.axis" class="motionDof">
      <label class="motionDofLabel">
        <span>{{ s.label }}</span>
        <span class="motionDofValue">{{ Math.round(s.value) }}°</span>
      </label>
      <input
        type="range"
        :aria-label="s.label"
        :min="s.min"
        :max="s.max"
        :value="s.value"
        step="1"
        @input="onSlider(s.axis, ($event.target as HTMLInputElement).value)"
      />
      <p v-if="s.atLimit" class="motionAtLimit" role="status">{{ t('modelMotionAtLimit') }}</p>
    </div>
    <UiButton variant="secondary" data-testid="motion-reset" @click="emit('resetPose')">
      {{ t('modelMotionReset') }}
    </UiButton>
  </div>
</template>

<style scoped>
.motionControls {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.motionDof {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.motionDofLabel {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}
.motionDofValue {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}
.motionDof input[type='range'] {
  width: 100%;
}
/* 觸界提示（非色彩通道＋琥珀；§3.6 不僅依顏色）。 */
.motionAtLimit {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-warning, #b26a00);
}
</style>
