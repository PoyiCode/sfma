import { describe, expect, it } from 'vitest';
import { appSettingsSchema } from '@ptapp/shared';
import { defaultAppSettings } from './settingsModel';

describe('defaultAppSettings', () => {
  it('產生通過 schema 驗證的預設設定', () => {
    const settings = defaultAppSettings('assessor-1', '2026-06-13T09:00:00+08:00');
    expect(settings.settingsId).toBe('app');
    expect(settings.locale).toBe('zh-TW');
    expect(settings.theme).toBe('system');
    expect(settings.therapistProfile).toEqual({ assessorId: 'assessor-1', name: '' });
    expect(settings.defaultLayers.bone).toBe(true);
    expect(() => appSettingsSchema.parse(settings)).not.toThrow();
  });
});
