// @vitest-environment jsdom
import { defineComponent } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { useInstallPrompt, type InstallPrompt } from './useInstallPrompt';

// onMounted 須於掛載元件內執行，故以測試元件承載 composable，回傳值經 expose 取出。
function mountHook(): { prompt: InstallPrompt; unmount: () => void } {
  let captured: InstallPrompt;
  const Host = defineComponent({
    setup(_props, { expose }) {
      captured = useInstallPrompt();
      expose({});
      return () => null;
    },
  });
  const wrapper = mount(Host);
  return { prompt: captured!, unmount: () => wrapper.unmount() };
}

function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(event);
  return event;
}

describe('useInstallPrompt', () => {
  it('初始 canPrompt 為偽；promptInstall 回 unavailable', async () => {
    const { prompt, unmount } = mountHook();
    expect(prompt.canPrompt.value).toBe(false);
    expect(await prompt.promptInstall()).toBe('unavailable');
    unmount();
  });

  it('捕捉 beforeinstallprompt → canPrompt 為真；promptInstall 叫起並回 outcome、之後清空', async () => {
    const { prompt, unmount } = mountHook();
    const event = fireBeforeInstallPrompt('accepted');
    await flushPromises();
    expect(prompt.canPrompt.value).toBe(true);
    const outcome = await prompt.promptInstall();
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('accepted');
    expect(prompt.canPrompt.value).toBe(false);
    unmount();
  });

  it('appinstalled 後清空 canPrompt', async () => {
    const { prompt, unmount } = mountHook();
    fireBeforeInstallPrompt();
    await flushPromises();
    expect(prompt.canPrompt.value).toBe(true);
    window.dispatchEvent(new Event('appinstalled'));
    await flushPromises();
    expect(prompt.canPrompt.value).toBe(false);
    unmount();
  });
});
