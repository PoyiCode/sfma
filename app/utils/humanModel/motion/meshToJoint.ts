// mesh→關節反查（04 §4.3.3）：點選身體部位→其控制關節（節段）。純函式。
import { segmentMembershipAll } from './jointKinematics';

const SIDE_SUFFIX = /#([LR])$/;

let memo: ReadonlyMap<string, string> | null = null;
// anatomyId → 控制其之 segment jointId（一次建表）。
function reverseMap(): ReadonlyMap<string, string> {
  if (memo) return memo;
  const m = new Map<string, string>();
  for (const [jointId, ids] of segmentMembershipAll()) {
    for (const id of ids) m.set(id, jointId);
  }
  memo = m;
  return m;
}

export function stripSide(meshName: string): string {
  return meshName.replace(SIDE_SUFFIX, '');
}

export function jointForMesh(meshName: string): string | null {
  return reverseMap().get(stripSide(meshName)) ?? null;
}

export function sideOfMesh(meshName: string): '#L' | '#R' | null {
  const m = meshName.match(SIDE_SUFFIX);
  return m ? (`#${m[1]}` as '#L' | '#R') : null;
}
