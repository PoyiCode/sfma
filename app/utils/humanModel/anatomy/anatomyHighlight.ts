import type { BodyAnnotation } from '@ptapp/shared';
import { partKey } from './partKey';

// 高亮著色類型（同 bodyAnnotation.findingType，06 §6.3）：painful／dysfunctional／note。
export type AnnotationFindingType = BodyAnnotation['findingType'];

// partKey（側別限定，anatomyId@side／中線即 anatomyId）→ 代表性 findingType 之高亮對照（§4.5 反向）。
export type AnnotationHighlights = ReadonlyMap<string, AnnotationFindingType>;

// 嚴重度（疼痛優先，06 §6.3）：同部位多筆標註時著色取最高者。
const FINDING_SEVERITY: Readonly<Record<AnnotationFindingType, number>> = {
  painful: 3,
  dysfunctional: 2,
  note: 1,
};

// 由評估之 bodyAnnotations 推導模型高亮對照（§4.5 反向：開啟評估→高亮標註部位）。
// 純函式、**側別敏感**（解3d資產：取消左右群組化）——key 為 partKey（anatomyId＋annotation.side），
// 故左肱骨標註僅高亮左肱骨 mesh；同 partKey 多筆取最高嚴重度（疼痛優先，06 §6.3）。
export function annotationHighlights(annotations: readonly BodyAnnotation[]): AnnotationHighlights {
  const result = new Map<string, AnnotationFindingType>();
  for (const annotation of annotations) {
    const key = partKey(annotation.anatomyId, annotation.side);
    const current = result.get(key);
    if (
      current === undefined ||
      FINDING_SEVERITY[annotation.findingType] > FINDING_SEVERITY[current]
    ) {
      result.set(key, annotation.findingType);
    }
  }
  return result;
}
