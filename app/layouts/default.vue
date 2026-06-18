<script setup lang="ts">
// App Shell 持久版面（對應 ptApp AppShell + AppBar；§3.3.3、§3.2）：App Bar（情境標題＋返回＋設定）
// ＋內容區＋暫態層（FirstLaunchNotice／InstallGuide）。data-breakpoint 供 CSS／master-detail，
// data-orientation 供同斷點內依方向重排（CSS／狀態訊號、不觸發資料重載），data-locale 供語系相依樣式。
// skip link（§3.7.5 Bypass Blocks）＝殼層首焦點，鍵盤略過 App Bar 跳至 main#appMain。
import { computed, ref, watch } from 'vue';
import { useBreakpoint } from '../composables/app/useBreakpoint';
import { useOrientation } from '../composables/app/useOrientation';
import UiIconButton from '../components/base/IconButton.vue';
import FirstLaunchNotice from '../components/app/FirstLaunchNotice.vue';
import InstallGuide from '../components/app/InstallGuide.vue';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();

const breakpoint = useBreakpoint();
const orientation = useOrientation();

// 情境標題（§3.3.3）：頁面以 definePageMeta({ titleKey }) 宣告，取最深有 titleKey 之 matched 記錄；
// 無則回退 appTitle。route.matched 由外而內排序，故自尾端反向找。
const titleKey = computed<string>(() => {
  const matched = route.matched;
  for (let i = matched.length - 1; i >= 0; i -= 1) {
    const key = matched[i]?.meta?.titleKey;
    if (typeof key === 'string' && key.length > 0) return key;
  }
  return 'appTitle';
});

// 非根路徑顯返回鍵（瀏覽器 back）。
const isRoot = computed(() => route.path === '/');

// 內容捲動容器（取代文件捲動，使 App Bar 全寬填滿）：路由切換時手動回頂，
// 取代瀏覽器文件捲動原有的「換頁回到頂端」行為。
const appMainRef = ref<HTMLElement>();
watch(
  () => route.path,
  () => {
    appMainRef.value?.scrollTo({ top: 0 });
  },
);

function goBack(): void {
  router.back();
}

function goSettings(): void {
  void navigateTo('/settings');
}
</script>

<template>
  <div
    class="appShell"
    :data-breakpoint="breakpoint"
    :data-orientation="orientation"
    :data-locale="locale"
  >
    <a class="skipLink" href="#appMain">{{ t('skipToContent') }}</a>
    <header class="appBar">
      <span v-if="isRoot" class="appBarLead" aria-hidden="true" />
      <UiIconButton v-else class="appBarBack" :label="t('navBack')" icon="‹" @click="goBack" />
      <h1 class="appBarTitle">{{ t(titleKey) }}</h1>
      <UiIconButton class="appBarSettings" :label="t('navSettings')" icon="⚙" @click="goSettings" />
    </header>
    <main id="appMain" ref="appMainRef" class="appScroll" tabindex="-1">
      <div class="appContent">
        <slot />
      </div>
    </main>
    <FirstLaunchNotice />
    <InstallGuide />
  </div>
</template>

<style scoped>
/* App Shell 版面；顏色一律取 semantic token（03 §3.7）。 */
.appShell {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh; /* 後備：不支援 dvh 之瀏覽器 */
  height: 100dvh; /* 動態視口高：iOS 動態工具列顯隱時內容高度正確 */
  /* 殼層本身不捲動；捲動移至內容區（.appScroll），使 App Bar 在捲動容器之外、恆全寬填滿
     （捲軸出現/消失皆不影響、無捲軸槽空隙；issue 1）。 */
  overflow: hidden;
  background: var(--color-bg);
  color: var(--color-text);
}

/* App Bar：持久頂列，底色／邊框取 semantic token（03 §3.3.3、§3.7）。 */
.appBar {
  display: grid;
  grid-template-columns: var(--target-min) 1fr var(--target-min);
  align-items: center;
  gap: var(--space-2);
  /* iOS viewport-fit=cover：內容列下推至瀏海／Dynamic Island 之下、表面色填滿狀態列區；
     橫式側邊缺口以 inline 安全區內距避讓（box-sizing:border-box 故 min-height 併 inset 維持列高）。 */
  padding-block: env(safe-area-inset-top) 0;
  padding-inline: max(var(--space-2), env(safe-area-inset-left))
    max(var(--space-2), env(safe-area-inset-right));
  min-height: calc(var(--control-height) + env(safe-area-inset-top));
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
}

.appBarTitle {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.appBarLead {
  display: block;
}

.appBarSettings {
  justify-self: end;
}

/* 內容捲動容器（取代文件捲動）：全寬，捲軸落在視口右緣；捲軸槽 stable 預留於此（背景色區、
   空槽不顯），故 App Bar 在其外恆全寬填滿、版面不因捲軸顯隱位移。 */
.appScroll {
  flex: 1;
  min-height: 0; /* 允許 flex 子項收縮以內部捲動，而非撐高殼層 */
  width: 100%;
  overflow-y: auto;
  scrollbar-gutter: stable; /* 原 html 之「捲軸出現/消失不位移」保證移至此 */
  overscroll-behavior-y: contain; /* 防過捲串聯（原於 html） */
}

.appContent {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  /* iOS viewport-fit=cover：底部避讓 home indicator、橫式側邊避讓缺口（max() 保非缺口裝置零變化）。 */
  padding-block: var(--space-4) max(var(--space-4), env(safe-area-inset-bottom));
  padding-inline: max(var(--space-4), env(safe-area-inset-left))
    max(var(--space-4), env(safe-area-inset-right));
}

.appShell[data-breakpoint='compact'] .appContent {
  padding-block: var(--space-3) max(var(--space-3), env(safe-area-inset-bottom));
  padding-inline: max(var(--space-3), env(safe-area-inset-left))
    max(var(--space-3), env(safe-area-inset-right));
}

/* 跳至主內容（WCAG 2.4.1 Bypass Blocks，§3.7.5）：預設移出視口、鍵盤聚焦時滑入；非 display:none 以保持可聚焦。 */
.skipLink {
  position: absolute;
  inset-block-start: var(--space-2);
  inset-inline-start: var(--space-2);
  z-index: 20;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transform: translateY(-200%);
  transition: transform var(--motion-fast) var(--easing-standard);
}

.skipLink:focus {
  transform: translateY(0);
}
</style>
