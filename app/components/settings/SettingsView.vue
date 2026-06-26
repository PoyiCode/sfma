<script setup lang="ts">
// 設定主畫面（03 §3.3、§3.7）：受控展示元件——settings 入、change 出（事件處理於頁面容器）。
// 治療師資料／顯示偏好／資料管理（匯出＋拖放/點選匯入）／關於·授權＋資料安全指引。
import { computed, ref } from 'vue';
import type { AppSettings } from '@ptapp/shared';
import BaseButton from '../base/Button.vue';
import BaseInput from '../base/Input.vue';
import BaseCheckbox from '../base/Checkbox.vue';
import BaseSegmentedControl from '../base/SegmentedControl.vue';
import BaseAccordion from '../base/Accordion.vue';
import BaseAlertDialog from '../base/AlertDialog.vue';
import { useFileDrop } from '../../composables/app/useFileDrop';
import { useFullLodConfirm } from '../../composables/humanModel/useFullLodConfirm';
import FullLodConfirmDialog from '../humanModel/FullLodConfirmDialog.vue';

// 資料管理區塊受控介面（匯出動作於容器執行；03 §3.3.8）。
export interface SettingsDataExport {
  exporting: boolean;
  exportError: boolean;
}

type LayerKey = keyof AppSettings['defaultLayers'];

interface Props {
  settings: AppSettings;
  dataExport: SettingsDataExport;
  // 選填：true＝顯匯入還原選檔/拖放入口（休眠慣例，比照 onOpenBreakout）。
  importEnabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  importEnabled: false,
});

const emit = defineEmits<{
  change: [partial: Partial<AppSettings>];
  exportAll: [];
  selectImportFile: [file: File];
}>();

const { t } = useI18n();

// 匯出前確認對話框開關（純 UI 互動狀態；提示明文 JSON 含個資 08 §8.7）。
const exportConfirmOpen = ref(false);

// 拖放匯入（02 line 35）：拖放檔走與點選相同之 selectImportFile 鏈；未啟用則停用。
const { dragActive, dropHandlers } = useFileDrop({
  onFile: (file) => emit('selectImportFile', file),
  disabled: () => !props.importEnabled,
});

// 切換至「完整」LOD 前流量確認（巨大無損下載）：包裝 lodMode 切換、目標 full 才跳對話框。
const lodMode = computed(() => props.settings.lodMode);
const lodConfirm = useFullLodConfirm(lodMode, (mode) => emit('change', { lodMode: mode }));
const lodConfirmOpen = computed({
  get: () => lodConfirm.confirmOpen.value,
  set: (value: boolean) => {
    lodConfirm.confirmOpen.value = value;
  },
});

// 僅列出已備妥訊息檔之語系（目前僅 zh-TW）。en 待 i18n/locales/en.json 補齊並於
// nuxt.config 註冊後再開放，避免選了英文卻無翻譯（schema 仍保留 'en' 供未來啟用）。
const localeOptions = computed(() => [{ value: 'zh-TW', label: t('settingsLocaleZhTw') }]);
const themeOptions = computed(() => [
  { value: 'system', label: t('settingsThemeSystem') },
  { value: 'light', label: t('settingsThemeLight') },
  { value: 'dark', label: t('settingsThemeDark') },
]);
const lodOptions = computed(() => [
  { value: 'auto', label: t('settingsLodAuto') },
  { value: 'simplified', label: t('settingsLodSimplified') },
  { value: 'full', label: t('settingsLodFull') },
]);
const orientationOptions = computed(() => [
  { value: 'auto', label: t('settingsOrientationAuto') },
  { value: 'portrait', label: t('settingsOrientationPortrait') },
  { value: 'landscape', label: t('settingsOrientationLandscape') },
]);

const layerRows: Array<{ key: LayerKey; labelKey: string }> = [
  { key: 'bone', labelKey: 'settingsLayerBone' },
  { key: 'deepMuscle', labelKey: 'settingsLayerDeepMuscle' },
  { key: 'superficialMuscle', labelKey: 'settingsLayerSuperficialMuscle' },
  { key: 'nerve', labelKey: 'settingsLayerNerve' },
  { key: 'passiveStructure', labelKey: 'settingsLayerPassiveStructure' },
];

const securityGuideItems = computed(() => [
  { value: 'securityGuide', trigger: t('settingsSecurityGuideTitle') },
]);

function onName(value: string | number | undefined): void {
  emit('change', {
    therapistProfile: { ...props.settings.therapistProfile, name: String(value ?? '') },
  });
}

function onLayer(key: LayerKey, checked: boolean): void {
  emit('change', { defaultLayers: { ...props.settings.defaultLayers, [key]: checked } });
}

function onImportInputChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit('selectImportFile', file);
  input.value = '';
}
</script>

<template>
  <div class="settings">
    <section class="settingsBlock">
      <h2 class="settingsBlockTitle">{{ t('settingsTherapistTitle') }}</h2>
      <label class="settingsField">
        <span class="settingsFieldLabel">{{ t('settingsTherapistName') }}</span>
        <BaseInput
          :model-value="settings.therapistProfile.name"
          :placeholder="t('settingsTherapistNamePlaceholder')"
          @update:model-value="onName"
        />
      </label>
    </section>

    <section class="settingsBlock">
      <h2 class="settingsBlockTitle">{{ t('settingsDisplayTitle') }}</h2>

      <div class="settingsField">
        <span class="settingsFieldLabel">{{ t('settingsLocale') }}</span>
        <BaseSegmentedControl
          v-bind="{ ariaLabel: t('settingsLocale') }"
          :model-value="settings.locale"
          :options="localeOptions"
          @update:model-value="emit('change', { locale: $event as AppSettings['locale'] })"
        />
      </div>

      <div class="settingsField">
        <span class="settingsFieldLabel">{{ t('settingsTheme') }}</span>
        <BaseSegmentedControl
          v-bind="{ ariaLabel: t('settingsTheme') }"
          :model-value="settings.theme"
          :options="themeOptions"
          @update:model-value="emit('change', { theme: $event as AppSettings['theme'] })"
        />
      </div>

      <div class="settingsField">
        <span class="settingsFieldLabel">{{ t('settingsLod') }}</span>
        <BaseSegmentedControl
          v-bind="{ ariaLabel: t('settingsLod') }"
          :model-value="settings.lodMode"
          :options="lodOptions"
          @update:model-value="lodConfirm.requestLodMode($event as AppSettings['lodMode'])"
        />
      </div>

      <div class="settingsField">
        <span class="settingsFieldLabel">{{ t('settingsOrientation') }}</span>
        <BaseSegmentedControl
          v-bind="{ ariaLabel: t('settingsOrientation') }"
          :model-value="settings.orientationPreference"
          :options="orientationOptions"
          @update:model-value="
            emit('change', {
              orientationPreference: $event as AppSettings['orientationPreference'],
            })
          "
        />
      </div>

      <fieldset class="settingsLayers">
        <legend class="settingsFieldLabel">{{ t('settingsDefaultLayers') }}</legend>
        <BaseCheckbox
          v-for="row in layerRows"
          :key="row.key"
          :label="t(row.labelKey)"
          :model-value="settings.defaultLayers[row.key] ?? false"
          @update:model-value="onLayer(row.key, $event === true)"
        />
      </fieldset>

      <!-- 切換至「完整」LOD 之流量確認（無損模型巨大、首載大流量）；確認才套 full。 -->
      <FullLodConfirmDialog v-model:open="lodConfirmOpen" @confirm="lodConfirm.confirmFull" />
    </section>

    <section class="settingsBlock">
      <h2 class="settingsBlockTitle">{{ t('settingsDataTitle') }}</h2>
      <p class="settingsAboutLine">{{ t('settingsDataReminder') }}</p>
      <div class="settingsDataActions">
        <BaseButton
          variant="secondary"
          :disabled="dataExport.exporting"
          @click="exportConfirmOpen = true"
        >
          {{ t('settingsExportAll') }}
        </BaseButton>
        <div
          v-if="importEnabled"
          class="settingsImportDropzone"
          :data-drag-active="dragActive"
          data-testid="importDropzone"
          v-on="dropHandlers"
        >
          <label class="button settingsImportEntry" data-variant="secondary">
            {{ t('settingsImport') }}
            <input
              type="file"
              accept="application/json,.json"
              :aria-label="t('settingsImport')"
              class="settingsImportInput"
              @change="onImportInputChange"
            />
          </label>
          <p class="settingsImportDropHint">{{ t('settingsImportDropHint') }}</p>
        </div>
      </div>
      <p v-if="dataExport.exportError" role="alert" class="settingsError">
        {{ t('settingsExportAllError') }}
      </p>
      <!-- 匯出時提示：匯出檔為明文 JSON 且含個資、存放注意（08 §8.7、todo 09 line 9） -->
      <BaseAlertDialog
        v-model:open="exportConfirmOpen"
        :title="t('settingsExportConfirmTitle')"
        :description="t('settingsExportConfirmBody')"
        :cancel-label="t('settingsExportConfirmCancel')"
        :action-label="t('settingsExportConfirmAction')"
        @confirm="emit('exportAll')"
      />
    </section>

    <section class="settingsBlock">
      <h2 class="settingsBlockTitle">{{ t('settingsAboutTitle') }}</h2>
      <p class="settingsAboutLine">{{ t('settingsAboutSfma') }}</p>
      <p class="settingsAboutLine">{{ t('settingsAboutAnatomy') }}</p>
      <p class="settingsAboutLine">{{ t('settingsAboutPrivacy') }}</p>
      <!-- 資料安全指引：裝置保護＋匯出檔處理守則就地呈現（08 §8.7、todo 09 line 21-22） -->
      <BaseAccordion type="single" :items="securityGuideItems">
        <template #securityGuide>
          <div class="settingsSecurityGuide">
            <h3 class="settingsSecurityGuideHeading">
              {{ t('settingsSecurityGuideDeviceTitle') }}
            </h3>
            <ul class="settingsSecurityGuideList">
              <li>{{ t('settingsSecurityGuideDevice1') }}</li>
              <li>{{ t('settingsSecurityGuideDevice2') }}</li>
            </ul>
            <h3 class="settingsSecurityGuideHeading">
              {{ t('settingsSecurityGuideExportTitle') }}
            </h3>
            <ul class="settingsSecurityGuideList">
              <li>{{ t('settingsSecurityGuideExport1') }}</li>
              <li>{{ t('settingsSecurityGuideExport2') }}</li>
              <li>{{ t('settingsSecurityGuideExport3') }}</li>
            </ul>
          </div>
        </template>
      </BaseAccordion>
    </section>
  </div>
</template>

<style scoped>
/* 設定頁版面；顏色取 semantic token（03 §3.3、§3.7）。 */
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 640px;
}

.settingsBlock {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.settingsBlockTitle {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  letter-spacing: var(--tracking-tight);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
}

.settingsField {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.settingsFieldLabel {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.settingsLayers {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin: 0;
}

.settingsAboutLine {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.settingsDataActions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.settingsError {
  margin: 0;
  color: var(--color-danger-fg);
  font-size: var(--font-size-sm);
}

/* 拖放匯入區（02 line 35）：虛線框＋拖曳中高亮，內含選檔入口與拖放提示 */
.settingsImportDropzone {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  align-items: flex-start;
  padding: var(--space-2);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.settingsImportDropzone[data-drag-active='true'] {
  border-color: var(--color-accent);
  background-color: var(--color-surface);
}

.settingsImportDropHint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.settingsImportEntry {
  cursor: pointer;
}

.settingsImportInput {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* 資料安全指引（關於區塊可展開內容；08 §8.7） */
.settingsSecurityGuide {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.settingsSecurityGuideHeading {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.settingsSecurityGuideList {
  margin: 0;
  padding-inline-start: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}
</style>
