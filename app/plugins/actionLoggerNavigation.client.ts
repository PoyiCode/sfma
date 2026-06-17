import { actionLogger } from '../utils/devtools/actionLogger';

// 導覽埋點（02 §2.11；正式建置 actionLogger 為 no-op，免條件包裹）。
// 對應 ptApp main.tsx 之 router.subscribe；Nuxt 以 Vue Router afterEach。
export default defineNuxtPlugin(() => {
  const router = useRouter();
  router.afterEach((to, from) => {
    if (to.fullPath !== from.fullPath) {
      actionLogger.log('navigation', 'routeChange', `${from.fullPath}→${to.fullPath}`);
    }
  });
});
