import { describe, expect, it } from 'vitest';
import { extractDroppedFile } from './fileDrop';

// 純函式：自 DataTransfer 取首檔（拖放匯入用，02 line 35）。以物件 mock 取代真實
// DataTransfer/File（僅取 files[0]、不依賴實體型別），於 node 環境亦可測。
function transfer(files: unknown[]) {
  return { files } as unknown as DataTransfer;
}

describe('extractDroppedFile（拖放取檔純函式）', () => {
  it('回傳 files 首檔', () => {
    const file = { name: 'backup.json' };
    expect(extractDroppedFile(transfer([file]))).toBe(file);
  });

  it('多檔僅取首檔', () => {
    const first = { name: 'a.json' };
    const second = { name: 'b.json' };
    expect(extractDroppedFile(transfer([first, second]))).toBe(first);
  });

  it('空 files 回 null', () => {
    expect(extractDroppedFile(transfer([]))).toBeNull();
  });

  it('null dataTransfer 回 null', () => {
    expect(extractDroppedFile(null)).toBeNull();
  });
});
