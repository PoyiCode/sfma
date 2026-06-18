// FPS 持續過低自動降級決策（04 §4.3.5 執行期監測 FPS 動態降級／§4.3.6 降級規則）：
// 純框架無關邏輯、時間注入、決定性可測。判定「何時」該降級（去抖）——
// 實際「降一級」之分級轉移由 degradeLodTier 負責。呼叫端每幀／每秒以
// scene.getEngine().getFps() 取樣 → evaluateFpsDegrade → shouldDegrade 則
// setTier(degradeLodTier(tier))。門檻為初版工程啟發值、待實機量測校正（§4.3.6）。

export interface FpsDegradeConfig {
  // 低於此 FPS 視為過低（含相等＝OK，不算過低）。
  thresholdFps: number;
  // 須持續過低達此毫秒數才觸發降級。
  sustainedMs: number;
}

// §4.3.6：FPS 低於 25 持續 5 秒 → 降一級。
export const DEFAULT_FPS_DEGRADE_CONFIG: FpsDegradeConfig = {
  thresholdFps: 25,
  sustainedMs: 5000,
};

export interface FpsDegradeState {
  // 當前「低於門檻」連續區間的起始時間戳（ms）；未處於過低區間則為 null。
  lowSinceMs: number | null;
}

export const INITIAL_FPS_DEGRADE_STATE: FpsDegradeState = { lowSinceMs: null };

export interface FpsSample {
  fps: number;
  atMs: number;
}

export interface FpsDegradeResult {
  state: FpsDegradeState;
  shouldDegrade: boolean;
}

export function evaluateFpsDegrade(
  state: FpsDegradeState,
  sample: FpsSample,
  config: FpsDegradeConfig = DEFAULT_FPS_DEGRADE_CONFIG,
): FpsDegradeResult {
  // 門檻以上（含相等）：復原即清連續區間、不降級。
  if (sample.fps >= config.thresholdFps) {
    return { state: { lowSinceMs: null }, shouldDegrade: false };
  }
  // 低於門檻：起算（或沿用）連續區間。
  const lowSinceMs = state.lowSinceMs ?? sample.atMs;
  // 達持續時長 → 觸發降級並重置（觸發後須重新累積整個視窗才會再降一級）。
  if (sample.atMs - lowSinceMs >= config.sustainedMs) {
    return { state: { lowSinceMs: null }, shouldDegrade: true };
  }
  return { state: { lowSinceMs }, shouldDegrade: false };
}
