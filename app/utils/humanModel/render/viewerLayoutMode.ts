import type { Breakpoint } from '../../../composables/app/useBreakpoint';

// 螢幕方位（直式／橫式）；useOrientation composable 為 Phase 5B 移植，型別於此先行定義
// （與 ptApp app/useOrientation 之 Orientation 同值），供本框架無關佈局決策使用。
export type Orientation = 'portrait' | 'landscape';

export type ViewerLayoutMode = 'standard' | 'modelPriority' | 'sidePanel';

// 檢視器控制項佈局隨斷點（03 §3.1、§3.5）：手機橫式（Compact＋landscape）模型優先＋浮動工具列；
// Expanded 控制項收為側欄；其餘標準堆疊。維度中性之容器響應式佈局（3D 檢視器共用）。
export function viewerLayoutMode(
  breakpoint: Breakpoint,
  orientation: Orientation,
): ViewerLayoutMode {
  if (breakpoint === 'compact' && orientation === 'landscape') return 'modelPriority';
  if (breakpoint === 'expanded') return 'sidePanel';
  return 'standard';
}
