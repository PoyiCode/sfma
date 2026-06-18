// 「完整」LOD 切換流量確認（解3d資產「完整」級別）：完整版載入未壓縮原始模型（~38 MB），
// 首載大流量、低階裝置較卡，故切換至 full 前須經確認對話框（可取消）。本 composable 攔截 LOD 切換：
// 目標為 full 且當前非 full → 開確認（暫不套用）；確認才套 'full'；其餘目標直接套用。
// 設定頁與檢視器內 LOD 控制共用（兩切換點皆攔截）。純框架 state、領域中性。
import { ref, toValue, type Ref, type MaybeRefOrGetter } from 'vue';
import type { LodOverride } from '../../utils/humanModel/lod/lodTier';

export interface FullLodConfirm {
  // 包裝 LOD 切換請求：target===full 且當前非 full → 開確認對話框；否則直接 applyLodMode。
  requestLodMode: (next: LodOverride) => void;
  // 確認對話框開關狀態（餵 AlertDialog open，v-model）。
  confirmOpen: Ref<boolean>;
  // 確認載入完整：套用 'full' 並關閉對話框。
  confirmFull: () => void;
}

export function useFullLodConfirm(
  currentMode: MaybeRefOrGetter<LodOverride>,
  applyLodMode: (mode: LodOverride) => void,
): FullLodConfirm {
  const confirmOpen = ref(false);

  function requestLodMode(next: LodOverride): void {
    // 已是 full 再選 full＝無切換、無需提醒。
    if (next === 'full' && toValue(currentMode) !== 'full') {
      confirmOpen.value = true;
      return;
    }
    applyLodMode(next);
  }

  function confirmFull(): void {
    applyLodMode('full');
    confirmOpen.value = false;
  }

  return { requestLodMode, confirmOpen, confirmFull };
}
