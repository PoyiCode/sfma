import type { BodyAnnotation, Side, SfmaPatternKey } from '@ptapp/shared';

// bodyAnnotation 的發現類型（06 §6.3）：painful／dysfunctional／note。
export type BodyAnnotationFindingType = BodyAnnotation['findingType'];

// 新標註（04 §4.5、06 §6.3）：選取部位＋關聯動作＋發現類型＋備註成一筆。
// annotationId 由呼叫端帶入（createUuid），純函式不呼叫 createUuid／new Date 以利測試（比照 newAssessmentSession）。
export function newBodyAnnotation(
  annotationId: string,
  anatomyId: string,
  side: Side,
  findingType: BodyAnnotationFindingType,
  linkedPatternKey: SfmaPatternKey,
  note = '',
): BodyAnnotation {
  return { annotationId, anatomyId, side, findingType, linkedPatternKey, note };
}

// 取既有標註（同 anatomyId×side 之首筆；未建回 undefined）——供「此部位是否已標註」判定。
export function findBodyAnnotation(
  annotations: readonly BodyAnnotation[],
  anatomyId: string,
  side: Side,
): BodyAnnotation | undefined {
  return annotations.find((a) => a.anatomyId === anatomyId && a.side === side);
}

// 寫入標註：同 annotationId 既有則取代、否則附加（不變動原陣列）。
export function upsertBodyAnnotation(
  annotations: readonly BodyAnnotation[],
  annotation: BodyAnnotation,
): BodyAnnotation[] {
  const index = annotations.findIndex((a) => a.annotationId === annotation.annotationId);
  if (index === -1) return [...annotations, annotation];
  const next = [...annotations];
  next[index] = annotation;
  return next;
}

// 移除標註（依 annotationId；不變動原陣列）。
export function removeBodyAnnotation(
  annotations: readonly BodyAnnotation[],
  annotationId: string,
): BodyAnnotation[] {
  return annotations.filter((a) => a.annotationId !== annotationId);
}
