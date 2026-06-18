import { computed, ref, type ComputedRef, type Ref } from 'vue';

export interface UseHiddenParts {
  // 已隱藏部位 partKey（依加入序）。
  hiddenIds: Ref<readonly string[]>;
  isHidden: (anatomyId: string) => boolean;
  hide: (anatomyId: string) => void;
  restore: (anatomyId: string) => void;
  restoreAll: () => void;
}

// 單一部位隱藏檢視狀態（輔助操作，檢視狀態、不入資料；04 §4.1）。
// 以陣列保加入序，重複 hide 同 id 不重出。
// React useState→ref、useMemo→computed、useCallback→一般函式（穩定參考由 composable 範圍保證）。
export function useHiddenParts(): UseHiddenParts {
  const hiddenIds = ref<readonly string[]>([]);

  function hide(anatomyId: string): void {
    if (!hiddenIds.value.includes(anatomyId)) hiddenIds.value = [...hiddenIds.value, anatomyId];
  }

  function restore(anatomyId: string): void {
    hiddenIds.value = hiddenIds.value.filter((id) => id !== anatomyId);
  }

  function restoreAll(): void {
    if (hiddenIds.value.length !== 0) hiddenIds.value = [];
  }

  const hiddenSet: ComputedRef<Set<string>> = computed(() => new Set(hiddenIds.value));
  function isHidden(anatomyId: string): boolean {
    return hiddenSet.value.has(anatomyId);
  }

  return { hiddenIds, isHidden, hide, restore, restoreAll };
}
