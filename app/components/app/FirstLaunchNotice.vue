<script setup lang="ts">
// 首啟資料保全通知（03 §3.3.6、§3.6、08 §8.7）：一次性、非阻擋。設定就緒且未確認過 →
// 顯「資料存於本機、定期匯出」Callout；關閉寫 dataSafetyNoticeAcknowledged（useSettings.update 持久化）。
// 載入中／錯誤／已確認皆不渲染（不阻擋殼層）。
import { computed } from 'vue';
import type { Repository } from '../../utils/data/repository';
import { localStore } from '../../utils/data/localStore';
import { useSettings } from '../../composables/settings/useSettings';
import BaseCallout from '../base/Callout.vue';

interface Props {
  repo?: Pick<Repository, 'getSettings' | 'saveSettings'>;
}

const props = withDefaults(defineProps<Props>(), {
  repo: () => localStore,
});

const { t } = useI18n();
const settings = useSettings(props.repo);

const visible = computed(
  () =>
    settings.state.value.status === 'ready' &&
    settings.state.value.settings.dataSafetyNoticeAcknowledged !== true,
);

function dismiss(): void {
  void settings.update({ dataSafetyNoticeAcknowledged: true });
}
</script>

<template>
  <div v-if="visible" class="firstLaunchNotice">
    <BaseCallout
      tone="info"
      :title="t('firstLaunchNoticeTitle')"
      :dismiss-label="t('firstLaunchNoticeDismiss')"
      @dismiss="dismiss"
    >
      {{ t('firstLaunchNoticeBody') }}
    </BaseCallout>
  </div>
</template>

<style scoped>
.firstLaunchNotice {
  position: sticky;
  bottom: 0;
  z-index: var(--z-toast, 40);
  /* iOS：底部避讓 home indicator（背景仍及邊，max() 保非缺口裝置零變化）。 */
  padding: var(--space-3);
  padding-bottom: max(var(--space-3), env(safe-area-inset-bottom));
}
</style>
