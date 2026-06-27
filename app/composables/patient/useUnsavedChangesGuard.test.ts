// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref, type Ref } from 'vue';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createRouter, createMemoryHistory, RouterView, type Router } from 'vue-router';
import { useUnsavedChangesGuard, type UnsavedChangesGuard } from './useUnsavedChangesGuard';

// 每次 setup 掛載的 wrapper 收集起來，afterEach 卸載——否則元件殘留之 beforeunload 監聽
// 會跨測試污染（後續測試誤觸 preventDefault）。
const wrappers: VueWrapper[] = [];

// 掛載一個位於 /a、使用守衛的元件，並提供 router 以驅動跨路徑導航。
async function setup(
  active: Ref<boolean>,
): Promise<{ router: Router; guard: UnsavedChangesGuard }> {
  let guard: UnsavedChangesGuard;
  const Guarded = defineComponent({
    setup() {
      guard = useUnsavedChangesGuard(active);
      return () => h('div', 'a');
    },
  });
  const Other = defineComponent({ setup: () => () => h('div', 'b') });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/a', component: Guarded },
      { path: '/b', component: Other },
    ],
  });
  router.push('/a');
  await router.isReady();
  const wrapper = mount(defineComponent({ setup: () => () => h(RouterView) }), {
    global: { plugins: [router] },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return { router, guard: guard! };
}

afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount();
  vi.restoreAllMocks();
});

describe('useUnsavedChangesGuard（03 §3.3.5）', () => {
  it('active 時攔截跨路徑導航；confirm 放行', async () => {
    const { router, guard } = await setup(ref(true));
    const nav = router.push('/b');
    await flushPromises();
    expect(guard.blocked.value).toBe(true);
    expect(router.currentRoute.value.path).toBe('/a');
    guard.confirm();
    await nav;
    await flushPromises();
    expect(guard.blocked.value).toBe(false);
    expect(router.currentRoute.value.path).toBe('/b');
  });

  it('cancel 取消導航、留在原頁', async () => {
    const { router, guard } = await setup(ref(true));
    const nav = router.push('/b');
    await flushPromises();
    expect(guard.blocked.value).toBe(true);
    guard.cancel();
    await nav;
    await flushPromises();
    expect(guard.blocked.value).toBe(false);
    expect(router.currentRoute.value.path).toBe('/a');
  });

  it('inactive 時不攔截', async () => {
    const { router } = await setup(ref(false));
    await router.push('/b');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/b');
  });

  it('同路徑（query 變動）不攔截', async () => {
    const { router, guard } = await setup(ref(true));
    await router.push('/a?x=1');
    await flushPromises();
    expect(guard.blocked.value).toBe(false);
    expect(router.currentRoute.value.fullPath).toBe('/a?x=1');
  });

  it('active 時 beforeunload 觸發原生確認（preventDefault）', async () => {
    await setup(ref(true));
    const event = new Event('beforeunload', { cancelable: true });
    const prevent = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(prevent).toHaveBeenCalled();
  });

  it('inactive 時 beforeunload 不攔截', async () => {
    await setup(ref(false));
    const event = new Event('beforeunload', { cancelable: true });
    const prevent = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(prevent).not.toHaveBeenCalled();
  });
});
