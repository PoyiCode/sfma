// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { AppSettings } from '@ptapp/shared';
import type { Repository } from '../../utils/data/repository';
import FirstLaunchNotice from './FirstLaunchNotice.vue';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

type Repo = Pick<Repository, 'getSettings' | 'saveSettings'>;

function settings(over: Partial<AppSettings> = {}): AppSettings {
  return {
    schemaVersion: 1,
    settingsId: 'app',
    therapistProfile: { assessorId: 'a1', name: '' },
    locale: 'zh-TW',
    lodMode: 'auto',
    orientationPreference: 'auto',
    defaultLayers: { bone: true, deepMuscle: false, superficialMuscle: false, nerve: false },
    theme: 'system',
    updatedAt: '2026-06-14T09:00:00+08:00',
    ...over,
  };
}

function fakeRepo(initial: AppSettings): Repo {
  return {
    getSettings: vi.fn().mockResolvedValue(initial),
    saveSettings: vi.fn().mockImplementation((s: AppSettings) => Promise.resolve(s)),
  };
}

describe('FirstLaunchNotice（首啟資料保全通知；03 §3.6）', () => {
  it('未確認時顯示通知；點知道了→寫旗標並消失', async () => {
    const repo = fakeRepo(settings());
    const wrapper = mount(FirstLaunchNotice, { props: { repo } });
    await flushPromises();
    expect(wrapper.text()).toContain('firstLaunchNoticeTitle');
    const dismiss = wrapper.findAll('button').find((b) => b.text() === 'firstLaunchNoticeDismiss')!;
    await dismiss.trigger('click');
    await flushPromises();
    expect(repo.saveSettings).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(repo.saveSettings).mock.calls[0]![0];
    expect(saved.dataSafetyNoticeAcknowledged).toBe(true);
    expect(wrapper.text()).not.toContain('firstLaunchNoticeTitle');
  });

  it('已確認時不顯示通知', async () => {
    const repo = fakeRepo(settings({ dataSafetyNoticeAcknowledged: true }));
    const wrapper = mount(FirstLaunchNotice, { props: { repo } });
    await flushPromises();
    expect(repo.getSettings).toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('firstLaunchNoticeTitle');
  });
});
