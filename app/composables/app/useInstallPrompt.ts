import { onMounted, onUnmounted, ref, type Ref } from 'vue';

// beforeinstallprompt 非標準事件——最小型別宣告（03 §3.3.6）。
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export interface InstallPrompt {
  canPrompt: Ref<boolean>;
  promptInstall: () => Promise<InstallOutcome>;
}

// 捕捉 Chromium beforeinstallprompt（延遲叫起原生安裝）、appinstalled 後清空。
// React useState＋useEffect → Vue ref＋onMounted/onUnmounted 監聽（事件 handler 內賦值，無 effect 內 setState 問題）。
export function useInstallPrompt(): InstallPrompt {
  const deferred = ref<BeforeInstallPromptEvent | null>(null);
  const canPrompt = ref(false);

  function onBeforeInstallPrompt(event: Event): void {
    event.preventDefault();
    deferred.value = event as BeforeInstallPromptEvent;
    canPrompt.value = true;
  }

  function onAppInstalled(): void {
    deferred.value = null;
    canPrompt.value = false;
  }

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
  });
  onUnmounted(() => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
  });

  async function promptInstall(): Promise<InstallOutcome> {
    const event = deferred.value;
    if (!event) return 'unavailable';
    await event.prompt();
    const choice = await event.userChoice;
    deferred.value = null;
    canPrompt.value = false;
    return choice.outcome;
  }

  return { canPrompt, promptInstall };
}
