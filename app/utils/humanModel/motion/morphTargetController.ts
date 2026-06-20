// 極限屈曲 corrective morph 控制（spec 2026-06-20）：依關節屈曲角度設 morph influence，
// 回復 LBS candy-wrapper 塌陷之體積。morph 契約名＝`corr.<jointId>`（distal 關節）。

// morph 權重曲線：|angle| onset 下 0、ref 上 1、之間 smoothstep（C1 連續、端點導數 0）。
export function correctiveWeight(angleDeg: number, onsetDeg: number, refDeg: number): number {
  if (refDeg <= onsetDeg) return 0;
  const c = Math.min(1, Math.max(0, (Math.abs(angleDeg) - onsetDeg) / (refDeg - onsetDeg)));
  return c * c * (3 - 2 * c);
}
