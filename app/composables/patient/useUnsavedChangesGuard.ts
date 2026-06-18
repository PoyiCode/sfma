import { onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

export interface UnsavedChangesGuard {
  // 是否正攔截一個待確認的導航。
  blocked: Ref<boolean>;
  // 放行被攔截的導航（捨棄變更離開）。
  confirm: () => void;
  // 取消導航、留在原頁。
  cancel: () => void;
}

// 未存變更守衛（03 §3.3.5）：active（有未存草稿）期間以 vue-router onBeforeRouteLeave 攔截
// 「跨路徑」導航（含 back／pop），並掛 beforeunload 觸發瀏覽器關閉／重整原生確認。
// 僅依 path 變更攔截（同頁 query/hash 變動不擾）。React useUnsavedChangesGuard（useBlocker）對等。
export function useUnsavedChangesGuard(active: MaybeRefOrGetter<boolean>): UnsavedChangesGuard {
  const blocked = ref(false);
  // 暫存被攔下的導航解析器：confirm→放行（true）、cancel→留下（false）。
  let pendingResolve: ((proceed: boolean) => void) | undefined;

  onBeforeRouteLeave((to, from) => {
    if (!toValue(active) || to.path === from.path) return true;
    blocked.value = true;
    return new Promise<boolean>((resolve) => {
      pendingResolve = resolve;
    });
  });

  function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (!toValue(active)) return;
    event.preventDefault();
    event.returnValue = '';
  }

  watch(
    () => toValue(active),
    (isActive) => {
      if (typeof window === 'undefined') return;
      if (isActive) window.addEventListener('beforeunload', handleBeforeUnload);
      else window.removeEventListener('beforeunload', handleBeforeUnload);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  });

  function settle(proceed: boolean): void {
    blocked.value = false;
    const resolve = pendingResolve;
    pendingResolve = undefined;
    resolve?.(proceed);
  }

  return {
    blocked,
    confirm: () => settle(true),
    cancel: () => settle(false),
  };
}
