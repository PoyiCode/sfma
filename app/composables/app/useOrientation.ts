import { onMounted, onUnmounted, ref, type Ref } from 'vue';

export type Orientation = 'portrait' | 'landscape';

const LANDSCAPE_QUERY = '(orientation: landscape)';

// 由 landscape media query 命中與否決定方向（03 §3.1、§3.2）。
export function orientationForLandscape(isLandscape: boolean): Orientation {
  return isLandscape ? 'landscape' : 'portrait';
}

function landscapeMql(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(LANDSCAPE_QUERY);
}

// React useSyncExternalStore(matchMedia) → Vue ref＋matchMedia change 監聽。
// SSR／首繪／無 matchMedia 預設 portrait（mobile-first 直式）；onMounted 後以實際命中校正、
// matchMedia change 為唯一外部來源。
export function useOrientation(): Ref<Orientation> {
  const orientation = ref<Orientation>('portrait');
  let mql: MediaQueryList | null = null;

  function update(): void {
    orientation.value = orientationForLandscape(mql?.matches ?? false);
  }

  onMounted(() => {
    mql = landscapeMql();
    if (mql === null) return;
    update();
    mql.addEventListener('change', update);
  });
  onUnmounted(() => {
    mql?.removeEventListener('change', update);
  });

  return orientation;
}
