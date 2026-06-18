// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { AppSettings } from '@ptapp/shared';
import type { Repository } from '../../utils/data/repository';
import InstallGuide from './InstallGuide.vue';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

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

function mountGuide(props: Record<string, unknown>) {
  return mount(InstallGuide, { props });
}

describe('InstallGuide（PWA 安裝引導；03 §3.3.6）', () => {
  it('可提示（canPrompt）→ 顯安裝鈕（prompt 模式）', async () => {
    const repo = fakeRepo(settings());
    const wrapper = mountGuide({
      repo,
      userAgent: ANDROID_CHROME,
      standalone: false,
      canPromptOverride: true,
    });
    await flushPromises();
    expect(wrapper.text()).toContain('installGuideTitle');
    expect(wrapper.text()).toContain('installGuideAction');
  });

  it('iOS Safari 不可提示 → 顯加入主畫面指引（iosManual 模式）', async () => {
    const repo = fakeRepo(settings());
    const wrapper = mountGuide({
      repo,
      userAgent: IPHONE_SAFARI,
      standalone: false,
      canPromptOverride: false,
    });
    await flushPromises();
    expect(wrapper.text()).toContain('installGuideIosBody');
    expect(wrapper.text()).not.toContain('installGuideAction');
  });

  it('已關閉（installGuideDismissed）→ 不渲染', async () => {
    const repo = fakeRepo(settings({ installGuideDismissed: true }));
    const wrapper = mountGuide({
      repo,
      userAgent: ANDROID_CHROME,
      standalone: false,
      canPromptOverride: true,
    });
    await flushPromises();
    expect(wrapper.text()).not.toContain('installGuideTitle');
  });

  it('standalone（已安裝）→ hidden 不渲染（即使可提示）', async () => {
    const repo = fakeRepo(settings());
    const wrapper = mountGuide({
      repo,
      userAgent: ANDROID_CHROME,
      standalone: true,
      canPromptOverride: true,
    });
    await flushPromises();
    expect(wrapper.text()).not.toContain('installGuideTitle');
  });

  it('點稍後再說 → 寫 installGuideDismissed 並消失', async () => {
    const repo = fakeRepo(settings());
    const wrapper = mountGuide({
      repo,
      userAgent: IPHONE_SAFARI,
      standalone: false,
      canPromptOverride: false,
    });
    await flushPromises();
    const dismiss = wrapper.findAll('button').find((b) => b.text() === 'installGuideDismiss')!;
    await dismiss.trigger('click');
    await flushPromises();
    expect(repo.saveSettings).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repo.saveSettings).mock.calls[0]![0].installGuideDismissed).toBe(true);
    expect(wrapper.text()).not.toContain('installGuideTitle');
  });
});
