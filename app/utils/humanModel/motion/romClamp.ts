// ROM 鉗制（04 §4.3.3）：將請求角度夾於關節某自由度之 [min, max]；觸界（含被夾回）回報 atLimit
// 供 UI 警示色／文字提示（§4.3.3 達極限給視覺提示）。純函式、node 可測。
import type { Joint } from '@ptapp/shared';

// 單一自由度描述：對齊 definitions joint.degreesOfFreedom 之元素（axis/min/max/neutral/unit）。
export type DegreeOfFreedom = Joint['degreesOfFreedom'][number];

export interface ClampResult {
  // 鉗制後角度（deg）
  value: number;
  // 是否觸及（或超出被夾回）ROM 邊界
  atLimit: boolean;
}

export function clampAngle(
  dof: Pick<DegreeOfFreedom, 'min' | 'max'>,
  requested: number,
): ClampResult {
  if (requested <= dof.min) return { value: dof.min, atLimit: true };
  if (requested >= dof.max) return { value: dof.max, atLimit: true };
  return { value: requested, atLimit: false };
}
