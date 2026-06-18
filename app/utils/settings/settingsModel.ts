import { CURRENT_SCHEMA_VERSION, type AppSettings } from '@ptapp/shared';

// 首次無設定時的預設（06 §6.10）：assessorId 由呼叫端 createUuid 產生、updatedAt 由呼叫端帶入；
// 純函式不呼叫 new Date()／createUuid 以利測試。儲存時 localStore.saveSettings 會再蓋 updatedAt。
export function defaultAppSettings(assessorId: string, now: string): AppSettings {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settingsId: 'app',
    therapistProfile: { assessorId, name: '' },
    locale: 'zh-TW',
    lodMode: 'auto',
    orientationPreference: 'auto',
    defaultLayers: {
      bone: true,
      deepMuscle: true,
      superficialMuscle: true,
      nerve: false,
      passiveStructure: false,
    },
    theme: 'system',
    updatedAt: now,
  };
}
