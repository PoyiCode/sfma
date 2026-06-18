// 通用拖放 composable（02 line 35 拖放匯入、領域中性，比照 useHistoryDismiss／useInstallPrompt）：
// 回傳 dragActive（拖曳中視覺回饋，Ref）＋可展開於容器之 dropHandlers（v-on 物件語法）。拖放檔走呼叫端
// onFile（設定頁＝onSelectImportFile→useDataImport.selectFile，與點選同鏈）。
import { ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue';
import { extractDroppedFile } from '../../utils/app/fileDrop';

export interface UseFileDropOptions {
  onFile: (file: File) => void;
  disabled?: MaybeRefOrGetter<boolean>;
}

// Vue v-on 物件語法之事件鍵（小寫，對等 @dragenter 等）。
export interface FileDropHandlers {
  dragenter: (event: DragEvent) => void;
  dragover: (event: DragEvent) => void;
  dragleave: (event: DragEvent) => void;
  drop: (event: DragEvent) => void;
}

export interface UseFileDropResult {
  dragActive: Ref<boolean>;
  dropHandlers: FileDropHandlers;
}

// 僅對「含檔案」之拖曳反應（避免拖文字／元素誤觸）；dataTransfer.types 含 'Files'。
function dragHasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.from(types).includes('Files');
}

export function useFileDrop({ onFile, disabled = false }: UseFileDropOptions): UseFileDropResult {
  const dragActive = ref(false);
  // 深度計數：dragenter／dragleave 會於子元素間反覆觸發，計數歸零才視為真正離開（避閃爍）。
  let depth = 0;

  function isDisabled(): boolean {
    return toValue(disabled);
  }

  function dragenter(event: DragEvent): void {
    if (isDisabled() || !dragHasFiles(event)) return;
    event.preventDefault();
    depth += 1;
    dragActive.value = true;
  }

  function dragover(event: DragEvent): void {
    if (isDisabled() || !dragHasFiles(event)) return;
    event.preventDefault(); // 必要：未 preventDefault 則 drop 不會觸發
  }

  function dragleave(): void {
    if (isDisabled()) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) dragActive.value = false;
  }

  function drop(event: DragEvent): void {
    if (isDisabled()) return;
    event.preventDefault();
    depth = 0;
    dragActive.value = false;
    const file = extractDroppedFile(event.dataTransfer);
    if (file) onFile(file);
  }

  return { dragActive, dropHandlers: { dragenter, dragover, dragleave, drop } };
}
