// 拖放取檔純函式（02 line 35 拖放匯入）：自 DataTransfer 取首檔，無檔／null 回 null。
// 抽為純函式供脫鉤測（不依賴 DOM 事件）；拖放檔走與點選相同之 onSelectImportFile 鏈。
export function extractDroppedFile(dataTransfer: DataTransfer | null): File | null {
  const files = dataTransfer?.files;
  return files && files.length > 0 ? (files[0] ?? null) : null;
}
