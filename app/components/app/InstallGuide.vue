<script setup lang="ts">
// PWA 安裝引導（03 §3.3.6）：一次性、非阻擋。設定就緒且未關閉過、且平台可安裝 →
// Chromium 顯「安裝」鈕（叫起原生 beforeinstallprompt）、iOS Safari 顯「加入主畫面」指引。
// 關閉（或安裝後）寫 installGuideDismissed。載入中／錯誤／已關閉／已安裝皆不渲染。
import { computed } from 'vue';
import type { Repository } from '../../utils/data/repository';
import { localStore } from '../../utils/data/localStore';
import { useSettings } from '../../composables/settings/useSettings';
import { useInstallPrompt } from '../../composables/app/useInstallPrompt';
import { resolveInstallMode } from '../../utils/app/installPrompt';
import BaseButton from '../base/Button.vue';
import BaseCallout from '../base/Callout.vue';

// 已安裝 PWA 偵測：display-mode standalone（Chromium/Android）或 navigator.standalone（iOS）。
interface NavigatorStandalone {
  standalone?: boolean;
}
function detectStandalone(): boolean {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
  }
  return (
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & NavigatorStandalone).standalone === true
  );
}

// 測試注入：repo／userAgent／standalone／canPromptOverride 省略時用即時偵測。
// 預設值於 setup 內解析（不放 withDefaults 工廠，避免 defineProps 不可引用區域變數之限制）。
interface Props {
  repo?: Pick<Repository, 'getSettings' | 'saveSettings'>;
  userAgent?: string;
  standalone?: boolean;
  canPromptOverride?: boolean;
}

const props = defineProps<Props>();

const { t } = useI18n();
const settings = useSettings(props.repo ?? localStore);
const live = useInstallPrompt();

const userAgent = computed(
  () => props.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
);
const standalone = computed(() =>
  props.standalone !== undefined ? props.standalone : detectStandalone(),
);
const canPrompt = computed(() =>
  props.canPromptOverride !== undefined ? props.canPromptOverride : live.canPrompt.value,
);

const dismissed = computed(
  () =>
    settings.state.value.status === 'ready' &&
    settings.state.value.settings.installGuideDismissed === true,
);

const mode = computed(() =>
  resolveInstallMode({
    userAgent: userAgent.value,
    standalone: standalone.value,
    canPrompt: canPrompt.value,
  }),
);

const visible = computed(
  () => settings.state.value.status === 'ready' && !dismissed.value && mode.value !== 'hidden',
);

function dismiss(): void {
  void settings.update({ installGuideDismissed: true });
}

function handleInstall(): void {
  void (async () => {
    await live.promptInstall();
    await settings.update({ installGuideDismissed: true });
  })();
}
</script>

<template>
  <div v-if="visible" class="installGuide">
    <BaseCallout
      tone="info"
      :title="t('installGuideTitle')"
      :dismiss-label="t('installGuideDismiss')"
      @dismiss="dismiss"
    >
      <template v-if="mode === 'prompt'">
        <p class="installGuideBody">{{ t('installGuideBody') }}</p>
        <BaseButton @click="handleInstall">{{ t('installGuideAction') }}</BaseButton>
      </template>
      <p v-else class="installGuideBody">{{ t('installGuideIosBody') }}</p>
    </BaseCallout>
  </div>
</template>

<style scoped>
.installGuide {
  position: sticky;
  bottom: 0;
  z-index: var(--z-toast, 40);
  /* iOS：底部避讓 home indicator（背景仍及邊，max() 保非缺口裝置零變化）。 */
  padding: var(--space-3);
  padding-bottom: max(var(--space-3), env(safe-area-inset-bottom));
}

.installGuideBody {
  margin: 0 0 var(--space-2);
}
</style>
