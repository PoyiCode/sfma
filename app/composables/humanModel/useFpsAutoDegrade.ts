// live FPS 自動降級接線 composable（04 §4.3.5 執行期監測 FPS／§4.3.6 降級規則）：
// 薄接線層，包裹純決策 evaluateFpsDegrade——呼叫端（3D 檢視器）每次算繪後以
// scene.getEngine().getFps() 取樣 → 回傳之 sample(fps) → 達持續過低則呼 onDegrade
// （由容器 setTier(degradeLodTier(tier))）。state 以非響應式變數持（取樣不觸發重繪）、
// 時鐘注入（測試脫鉤、預設 performance.now）、enabled 閘（停用為 no-op 並重置視窗）。
import { toValue, watch, type MaybeRefOrGetter } from 'vue';
import {
  DEFAULT_FPS_DEGRADE_CONFIG,
  INITIAL_FPS_DEGRADE_STATE,
  evaluateFpsDegrade,
  type FpsDegradeConfig,
  type FpsDegradeState,
} from '../../utils/humanModel/lod/fpsDegrade';

function defaultNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

export interface UseFpsAutoDegradeOptions {
  // 啟用取樣（如僅於 3D 顯示時）；false 時 sample 為 no-op 並重置連續區間。
  enabled: MaybeRefOrGetter<boolean>;
  // 達持續過低時觸發（呼叫端據此 setTier(degradeLodTier(tier))）。
  onDegrade: () => void;
  // 去抖門檻（預設 §4.3.6：25fps／5000ms）。
  config?: FpsDegradeConfig;
  // 時鐘注入（測試脫鉤；預設 performance.now）。
  now?: () => number;
}

// 回傳取樣函式 sample(fps)：呼叫端於 render loop／onAfterRender 每幀帶入即時 fps。
export function useFpsAutoDegrade({
  enabled,
  onDegrade,
  config = DEFAULT_FPS_DEGRADE_CONFIG,
  now = defaultNow,
}: UseFpsAutoDegradeOptions): (fps: number) => void {
  // 非響應式持態（取樣高頻、不應觸發 Vue 響應）：以閉包變數持累積視窗。
  let state: FpsDegradeState = INITIAL_FPS_DEGRADE_STATE;

  // 停用即重置連續區間（重新啟用須重新累積整個視窗，避免跨停用期誤觸）。
  watch(
    () => toValue(enabled),
    (isEnabled) => {
      if (!isEnabled) state = INITIAL_FPS_DEGRADE_STATE;
    },
  );

  return (fps: number): void => {
    if (!toValue(enabled)) return;
    const result = evaluateFpsDegrade(state, { fps, atMs: now() }, config);
    state = result.state;
    if (result.shouldDegrade) onDegrade();
  };
}
