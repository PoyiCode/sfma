<script setup lang="ts">
// 已隱藏部位清單（檢視器控制項；04 §4.1）：逐一或「恢復全部」還原。
// 無隱藏部位時休眠（不渲染），避免控制列冗餘。
import UiButton from '../base/Button.vue';
import { anatomyDisplayName } from '../../utils/humanModel/anatomy/anatomyInfo';
import { parsePartKey } from '../../utils/humanModel/anatomy/partKey';

interface Props {
  // 已隱藏部位之 partKey（取消左右群組化）：成對為 anatomyId@side、中線即 anatomyId。
  hiddenIds: readonly string[];
}

defineProps<Props>();
const emit = defineEmits<{ restore: [partKey: string]; restoreAll: [] }>();

const { t } = useI18n();

// partKey → 顯示名（成對併「（左/右）」）。
function partKeyDisplayName(key: string): string {
  const { anatomyId, side } = parsePartKey(key);
  const suffix =
    side === 'left'
      ? `（${t('assessmentSideLeft')}）`
      : side === 'right'
        ? `（${t('assessmentSideRight')}）`
        : '';
  return `${anatomyDisplayName(anatomyId)}${suffix}`;
}
</script>

<template>
  <section
    v-if="hiddenIds.length > 0"
    class="hiddenPartsControls"
    :aria-label="t('hiddenPartsTitle')"
  >
    <div class="hiddenPartsHeader">
      <h3 class="hiddenPartsTitle">{{ t('hiddenPartsTitle') }}</h3>
      <UiButton variant="secondary" @click="emit('restoreAll')">
        {{ t('hiddenPartsRestoreAll') }}
      </UiButton>
    </div>
    <ul class="hiddenPartsList">
      <li v-for="partKeyId in hiddenIds" :key="partKeyId" class="hiddenPartsItem">
        <span class="hiddenPartsName">{{ partKeyDisplayName(partKeyId) }}</span>
        <UiButton
          variant="ghost"
          :aria-label="`${t('hiddenPartRestore')}：${partKeyDisplayName(partKeyId)}`"
          @click="emit('restore', partKeyId)"
        >
          {{ t('hiddenPartRestore') }}
        </UiButton>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.hiddenPartsControls {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.hiddenPartsHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.hiddenPartsTitle {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.hiddenPartsList {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.hiddenPartsItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.hiddenPartsName {
  color: var(--color-text);
}
</style>
