// 側別限定選取鍵（解3d資產：取消左右群組化）：anatomyId 刻意側別無關（06 §6.5），
// 但臨床評估為單側——故選取/高亮/標註沿 side 軸分流。中線部位（symmetry midline）無 side、
// key 即 anatomyId；成對部位 key＝`${anatomyId}@${side}`（`@` 不與 anatomyId 之 `.` 衝突）。
// 純函式；3D mesh metadata、2D 圖層 id、選取狀態、反向高亮 Map 皆以此為鍵。
export type AnatomySide = 'left' | 'right';

const SIDE_SEP = '@';

export function partKey(anatomyId: string, side: AnatomySide | null): string {
  return side === null ? anatomyId : `${anatomyId}${SIDE_SEP}${side}`;
}

export function parsePartKey(key: string): { anatomyId: string; side: AnatomySide | null } {
  const at = key.lastIndexOf(SIDE_SEP);
  if (at === -1) return { anatomyId: key, side: null };
  const side = key.slice(at + 1);
  if (side === 'left' || side === 'right') return { anatomyId: key.slice(0, at), side };
  // 非預期尾碼（anatomyId 不含 @）：防禦性整串視為 anatomyId、無側。
  return { anatomyId: key, side: null };
}
