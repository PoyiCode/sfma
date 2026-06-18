import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FPS_DEGRADE_CONFIG,
  INITIAL_FPS_DEGRADE_STATE,
  evaluateFpsDegrade,
} from './fpsDegrade';

// §4.3.6：FPS 低於 25 持續 5 秒 → 降一級。門檻 25／持續 5000ms（預設）。
const { thresholdFps } = DEFAULT_FPS_DEGRADE_CONFIG; // 25

describe('evaluateFpsDegrade（FPS 持續過低降級去抖；04 §4.3.5/§4.3.6）', () => {
  it('門檻以上：不降級、連續區間重置為 null', () => {
    // 先進入低於門檻累積區間
    const low = evaluateFpsDegrade(INITIAL_FPS_DEGRADE_STATE, { fps: 10, atMs: 1000 });
    expect(low.state.lowSinceMs).toBe(1000);
    // 復原至門檻以上 → 清區間
    const ok = evaluateFpsDegrade(low.state, { fps: 60, atMs: 2000 });
    expect(ok.shouldDegrade).toBe(false);
    expect(ok.state.lowSinceMs).toBeNull();
  });

  it('恰等於門檻視為 OK（>= 門檻不算過低）', () => {
    const r = evaluateFpsDegrade(INITIAL_FPS_DEGRADE_STATE, { fps: thresholdFps, atMs: 500 });
    expect(r.shouldDegrade).toBe(false);
    expect(r.state.lowSinceMs).toBeNull();
  });

  it('首次低於門檻：起算連續區間、尚不降級', () => {
    const r = evaluateFpsDegrade(INITIAL_FPS_DEGRADE_STATE, { fps: 20, atMs: 3000 });
    expect(r.shouldDegrade).toBe(false);
    expect(r.state.lowSinceMs).toBe(3000);
  });

  it('低於門檻但未達持續時長：不降級、保留起算點', () => {
    const start = evaluateFpsDegrade(INITIAL_FPS_DEGRADE_STATE, { fps: 18, atMs: 1000 });
    const mid = evaluateFpsDegrade(start.state, { fps: 18, atMs: 1000 + 4999 });
    expect(mid.shouldDegrade).toBe(false);
    expect(mid.state.lowSinceMs).toBe(1000);
  });

  it('低於門檻達持續時長：觸發降級並重置區間', () => {
    const start = evaluateFpsDegrade(INITIAL_FPS_DEGRADE_STATE, { fps: 18, atMs: 1000 });
    const fire = evaluateFpsDegrade(start.state, { fps: 18, atMs: 1000 + 5000 });
    expect(fire.shouldDegrade).toBe(true);
    expect(fire.state.lowSinceMs).toBeNull(); // 觸發後重置
  });

  it('觸發後：須重新累積整個視窗才會再降一級（避免單幀連降）', () => {
    const start = evaluateFpsDegrade(INITIAL_FPS_DEGRADE_STATE, { fps: 10, atMs: 0 });
    const fire = evaluateFpsDegrade(start.state, { fps: 10, atMs: 5000 });
    expect(fire.shouldDegrade).toBe(true);
    // 緊接著的低樣本不應立刻再觸發（重新起算）
    const next = evaluateFpsDegrade(fire.state, { fps: 10, atMs: 5016 });
    expect(next.shouldDegrade).toBe(false);
    expect(next.state.lowSinceMs).toBe(5016);
  });

  it('中途復原再轉低：重新起算連續視窗（復原中斷累積）', () => {
    const a = evaluateFpsDegrade(INITIAL_FPS_DEGRADE_STATE, { fps: 18, atMs: 1000 });
    const recovered = evaluateFpsDegrade(a.state, { fps: 40, atMs: 3000 }); // 復原 → 清區間
    expect(recovered.state.lowSinceMs).toBeNull();
    const relow = evaluateFpsDegrade(recovered.state, { fps: 18, atMs: 4000 }); // 重新起算
    expect(relow.state.lowSinceMs).toBe(4000);
    // 自 4000 起未達 5 秒不應降級（證明未沿用舊 1000 起算點）
    const stillOk = evaluateFpsDegrade(relow.state, { fps: 18, atMs: 4000 + 4999 });
    expect(stillOk.shouldDegrade).toBe(false);
  });

  it('可注入自訂門檻／持續時長', () => {
    const config = { thresholdFps: 30, sustainedMs: 2000 };
    const start = evaluateFpsDegrade(INITIAL_FPS_DEGRADE_STATE, { fps: 28, atMs: 0 }, config);
    expect(start.state.lowSinceMs).toBe(0); // 28 < 30 算過低
    const fire = evaluateFpsDegrade(start.state, { fps: 28, atMs: 2000 }, config);
    expect(fire.shouldDegrade).toBe(true);
  });
});
