<script setup lang="ts">
// 路由邊界載入畫面（03 §3.3.7「路由邊界顯示 skeleton」）。
// 無障礙：role=status + aria-busy 宣告載入中；視覺骨架 aria-hidden，SR 僅聽見 label。
import BaseSkeleton from './Skeleton.vue';

interface Props {
  // SR 宣讀之載入文字（呼叫端傳 t('loading')，保持原件 i18n 中性）。
  label: string;
  // 內容佔位行數（預設 3）。
  lines?: number;
}

withDefaults(defineProps<Props>(), {
  lines: 3,
});
</script>

<template>
  <div class="pageSkeleton" role="status" aria-busy="true">
    <span class="pageSkeletonLabel">{{ label }}</span>
    <BaseSkeleton variant="rect" class="pageSkeletonTitle" />
    <BaseSkeleton v-for="index in lines" :key="index" class="pageSkeletonLine" />
  </div>
</template>

<style scoped>
/* 路由邊界載入區（§3.3.7）。 */
.pageSkeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}

/* 載入文字僅供報讀軟體：視覺隱藏但保留於無障礙樹（無既有 sr-only 工具，就地定義）。 */
.pageSkeletonLabel {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.pageSkeletonTitle {
  width: 40%;
  height: var(--font-size-2xl);
}

.pageSkeletonLine {
  width: 100%;
}

.pageSkeletonLine:last-child {
  width: 70%;
}
</style>
