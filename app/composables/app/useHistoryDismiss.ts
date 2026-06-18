import { onMounted, onUnmounted } from 'vue';

// 疊層返回收合（03 §3.3.5、§3.3.9）：掛載期間推一個 history entry，系統返回／瀏覽器 back
// （popstate）＝呼 onDismiss 收合整層（不破壞資料）。回傳 dismiss()＝history.back() 退掉哨兵 entry，
// 觸發同一條 popstate→onDismiss 收合路徑——× 鈕與系統返回行為一致、無雙重關閉、歷史保持乾淨。
// React useHistoryDismiss(active, onDismiss) 之 active 切換以「掛載即啟用」對應：Overlay 僅於開啟時掛載本 composable。
export function useHistoryDismiss(onDismiss: () => void): () => void {
  function handlePopState(): void {
    onDismiss();
  }

  onMounted(() => {
    window.history.pushState({ breakoutOverlay: true }, '');
    window.addEventListener('popstate', handlePopState);
  });
  onUnmounted(() => {
    window.removeEventListener('popstate', handlePopState);
  });

  return () => {
    window.history.back();
  };
}
