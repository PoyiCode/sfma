import { defineStore } from 'pinia';

// App 全域 store 骨架（Phase 0 佔位；patient/assessment/settings 等 store 於各模組 Phase 加入）。
export const useAppStore = defineStore('app', {
  state: () => ({ ready: false }),
});
