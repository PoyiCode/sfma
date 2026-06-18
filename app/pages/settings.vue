<script setup lang="ts">
// 設定頁容器（03 §3.3）：useSettings 載入；語系／主題即時副作用後 update 持久化；
// 資料管理「匯出全部備份」複用 buildFullExport＋saveExportFile；「匯入還原」走 useDataImport＋
// ImportDialogView，匯入套用設定（settingsApplied）後 reload 設定使頁面反映。
import { computed, ref, watch } from 'vue';
import type { AppSettings } from '@ptapp/shared';
import { localStore } from '../utils/data/localStore';
import { buildFullExport, saveExportFile } from '../utils/data/exporter';
import { useSettings } from '../composables/settings/useSettings';
import { useDataImport } from '../composables/settings/useDataImport';
import SettingsView from '../components/settings/SettingsView.vue';
import ImportDialogView from '../components/settings/ImportDialogView.vue';
import PageSkeleton from '../components/ui/PageSkeleton.vue';
import PageError from '../components/ui/PageError.vue';

definePageMeta({ titleKey: 'titleSettings' });

const i18n = useI18n();
const { t } = i18n;
useHead({ title: () => t('titleSettings') });

// 主題：以 @nuxtjs/color-mode（@nuxt/ui 提供）對應 theme（system/light/dark）。
const colorMode = useColorMode();

const settings = useSettings();
const dataImport = useDataImport();

const exporting = ref(false);
const exportError = ref(false);

// 匯入套用備份設定（settingsApplied）後 reload 設定使頁面反映（對應 ptApp useEffect）。
watch(
  () => dataImport.phase.value,
  (phase) => {
    if (phase.status === 'done' && phase.result.settingsApplied) {
      settings.reload();
    }
  },
);

async function handleExportAll(): Promise<void> {
  exporting.value = true;
  exportError.value = false;
  try {
    await saveExportFile(await buildFullExport(localStore));
  } catch {
    exportError.value = true;
  } finally {
    exporting.value = false;
  }
}

function handleChange(partial: Partial<AppSettings>): void {
  // 語系即時切換（僅套用已註冊之 locale；en 尚未提供訊息檔時保留設定值、不破壞畫面）。
  // AppSettings.locale 聯集（zh-TW｜en）寬於 i18n 目前註冊集（zh-TW）；以 availableLocales 守衛後轉型。
  if (partial.locale !== undefined) {
    const available = i18n.availableLocales as readonly string[];
    if (available.includes(partial.locale)) {
      i18n.locale.value = partial.locale as typeof i18n.locale.value;
    }
  }
  // 主題即時套用（color mode preference）。
  if (partial.theme !== undefined) {
    colorMode.preference = partial.theme;
  }
  void settings.update(partial);
}

const readySettings = computed(() =>
  settings.state.value.status === 'ready' ? settings.state.value.settings : undefined,
);
</script>

<template>
  <PageSkeleton
    v-if="settings.state.value.status === 'loading'"
    :label="t('loading')"
    class="settingsStatus"
  />
  <PageError
    v-else-if="settings.state.value.status === 'error'"
    class="settingsStatus"
    :message="t('settingsLoadError')"
    :retry-label="t('retry')"
    @retry="settings.reload"
  />
  <div v-else-if="readySettings" class="settingsPage">
    <SettingsView
      :settings="readySettings"
      :data-export="{ exporting, exportError }"
      import-enabled
      @change="handleChange"
      @export-all="handleExportAll"
      @select-import-file="dataImport.selectFile"
    />
    <ImportDialogView
      :phase="dataImport.phase.value"
      :conflict-strategy="dataImport.conflictStrategy.value"
      :apply-settings="dataImport.applySettings.value"
      @conflict-strategy-change="dataImport.conflictStrategy.value = $event"
      @apply-settings-change="dataImport.applySettings.value = $event"
      @confirm="dataImport.confirmImport"
      @close="dataImport.reset"
    />
  </div>
</template>

<style scoped>
.settingsStatus {
  color: var(--color-text-muted);
}
</style>
