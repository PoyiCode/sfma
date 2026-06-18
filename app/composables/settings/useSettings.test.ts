// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import type { AppSettings } from '@ptapp/shared';
import { useSettings, type UseSettingsResult } from './useSettings';

function sampleSettings(): AppSettings {
  return {
    schemaVersion: 1,
    settingsId: 'app',
    therapistProfile: { assessorId: 'a1', name: '李治療師' },
    locale: 'zh-TW',
    lodMode: 'auto',
    orientationPreference: 'auto',
    defaultLayers: { bone: true, deepMuscle: false, superficialMuscle: false, nerve: false },
    theme: 'system',
    updatedAt: '2026-06-13T09:00:00+08:00',
  };
}

function run(setup: () => UseSettingsResult): { result: UseSettingsResult; stop: () => void } {
  const scope = effectScope();
  const result = scope.run(setup) as UseSettingsResult;
  return { result, stop: () => scope.stop() };
}

describe('useSettings', () => {
  it('無設定 → ready 帶預設（locale zh-TW、空姓名）', async () => {
    const repo = { getSettings: vi.fn().mockResolvedValue(undefined), saveSettings: vi.fn() };
    const { result, stop } = run(() => useSettings(repo));
    await flushPromises();
    expect(result.state.value.status).toBe('ready');
    expect(result.state.value.status === 'ready' && result.state.value.settings.locale).toBe(
      'zh-TW',
    );
    expect(
      result.state.value.status === 'ready' && result.state.value.settings.therapistProfile.name,
    ).toBe('');
    stop();
  });

  it('update 樂觀更新並持久化（saveSettings 回傳值蓋回）', async () => {
    const repo = {
      getSettings: vi.fn().mockResolvedValue(sampleSettings()),
      saveSettings: vi
        .fn()
        .mockImplementation((s: AppSettings) =>
          Promise.resolve({ ...s, updatedAt: '2026-06-13T10:00:00+08:00' }),
        ),
    };
    const { result, stop } = run(() => useSettings(repo));
    await flushPromises();
    await result.update({ theme: 'dark' });
    expect(repo.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'dark', settingsId: 'app' }),
    );
    expect(result.state.value.status === 'ready' && result.state.value.settings.theme).toBe('dark');
    stop();
  });

  it('讀取失敗 → error', async () => {
    const repo = { getSettings: vi.fn().mockRejectedValue(new Error('boom')), saveSettings: vi.fn() };
    const { result, stop } = run(() => useSettings(repo));
    await flushPromises();
    expect(result.state.value.status).toBe('error');
    stop();
  });

  it('reload 重新載入（error → ready）', async () => {
    const repo = {
      getSettings: vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue(sampleSettings()),
      saveSettings: vi.fn(),
    };
    const { result, stop } = run(() => useSettings(repo));
    await flushPromises();
    expect(result.state.value.status).toBe('error');
    result.reload();
    await nextTick();
    await flushPromises();
    expect(result.state.value.status).toBe('ready');
    stop();
  });
});
