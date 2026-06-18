import { onMounted, onUnmounted, ref, type Ref } from 'vue';

export type Breakpoint = 'compact' | 'medium' | 'expanded';

const MEDIUM_MIN = 600;
const EXPANDED_MIN = 1024;

// 以邏輯寬度（CSS px）分斷點，而非裝置型號（03 §3.2）。
export function breakpointForWidth(width: number): Breakpoint {
  if (width >= EXPANDED_MIN) return 'expanded';
  if (width >= MEDIUM_MIN) return 'medium';
  return 'compact';
}

// React useSyncExternalStore(resize) → Vue ref＋resize 監聽。SSR 關閉（SPA），但首繪預設 compact（mobile-first），
// onMounted 後以實際視窗寬度校正、resize 為唯一外部來源。
export function useBreakpoint(): Ref<Breakpoint> {
  const breakpoint = ref<Breakpoint>('compact');

  function update(): void {
    breakpoint.value = breakpointForWidth(window.innerWidth);
  }

  onMounted(() => {
    update();
    window.addEventListener('resize', update);
  });
  onUnmounted(() => {
    window.removeEventListener('resize', update);
  });

  return breakpoint;
}
