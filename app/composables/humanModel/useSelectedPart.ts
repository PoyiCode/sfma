import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { anatomyEntityById } from '@ptapp/definitions';
import type { AnatomyEntity } from '@ptapp/shared';
import { actionLogger } from '../../utils/devtools/actionLogger';
import { type AnatomySide, parsePartKey } from '../../utils/humanModel/anatomy/partKey';

export interface UseSelectedPart {
  // 選取鍵＝partKey（側別限定，取消左右群組化）：成對為 `anatomyId@side`、中線即 anatomyId。
  selectedId: Ref<string | null>;
  selected: ComputedRef<AnatomyEntity | null>;
  // 選取部位之側別（中線/無選取為 null）：供標註側別預填與資訊卡顯示。
  selectedSide: ComputedRef<AnatomySide | null>;
  select: (partKey: string) => void;
  toggle: (partKey: string) => void;
  clear: () => void;
}

// 人體模型部位選取狀態（檢視狀態、不寫入資料；04 §4.1）。selectedId 承載 partKey；
// selected 由 partKey 解析之 anatomyId 反查 anatomyEntityById（未知→null、selectedId 仍保留）。
export function useSelectedPart(initialId: string | null = null): UseSelectedPart {
  const selectedId = ref<string | null>(initialId);

  function select(key: string): void {
    actionLogger.log('humanModel', 'selectPart', key);
    selectedId.value = key;
  }

  function toggle(key: string): void {
    actionLogger.log('humanModel', 'togglePart', key);
    selectedId.value = selectedId.value === key ? null : key;
  }

  function clear(): void {
    selectedId.value = null;
  }

  const selected = computed<AnatomyEntity | null>(() =>
    selectedId.value === null
      ? null
      : (anatomyEntityById.get(parsePartKey(selectedId.value).anatomyId) ?? null),
  );
  const selectedSide = computed<AnatomySide | null>(() =>
    selectedId.value === null ? null : parsePartKey(selectedId.value).side,
  );

  return { selectedId, selected, selectedSide, select, toggle, clear };
}
