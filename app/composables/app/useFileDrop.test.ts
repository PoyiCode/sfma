// @vitest-environment jsdom
import { effectScope } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useFileDrop, type UseFileDropResult, type UseFileDropOptions } from './useFileDrop';

// DragEvent mock：僅含 handler 所讀之 preventDefault／dataTransfer（types／files）。
function dragEvent(opts: { files?: unknown[]; types?: string[] } = {}) {
  const preventDefault = vi.fn();
  const event = {
    preventDefault,
    dataTransfer: { files: opts.files ?? [], types: opts.types ?? ['Files'] },
  } as unknown as DragEvent;
  return { event, preventDefault };
}

function run(options: UseFileDropOptions): { result: UseFileDropResult; stop: () => void } {
  const scope = effectScope();
  const result = scope.run(() => useFileDrop(options)) as UseFileDropResult;
  return { result, stop: () => scope.stop() };
}

describe('useFileDrop（通用拖放 composable）', () => {
  it('拖入含檔 → dragActive 為真並 preventDefault；拖離歸零 → 復原偽', () => {
    const { result, stop } = run({ onFile: vi.fn() });
    expect(result.dragActive.value).toBe(false);

    const enter = dragEvent();
    result.dropHandlers.dragenter(enter.event);
    expect(result.dragActive.value).toBe(true);
    expect(enter.preventDefault).toHaveBeenCalled();

    result.dropHandlers.dragleave(dragEvent().event);
    expect(result.dragActive.value).toBe(false);
    stop();
  });

  it('drop 呼 onFile（帶首檔）＋preventDefault＋dragActive 復原', () => {
    const onFile = vi.fn();
    const { result, stop } = run({ onFile });
    result.dropHandlers.dragenter(dragEvent().event);

    const file = { name: 'backup.json' };
    const drop = dragEvent({ files: [file] });
    result.dropHandlers.drop(drop.event);

    expect(drop.preventDefault).toHaveBeenCalled();
    expect(onFile).toHaveBeenCalledWith(file);
    expect(result.dragActive.value).toBe(false);
    stop();
  });

  it('drop 無檔 → 不呼 onFile', () => {
    const onFile = vi.fn();
    const { result, stop } = run({ onFile });
    result.dropHandlers.drop(dragEvent({ files: [] }).event);
    expect(onFile).not.toHaveBeenCalled();
    stop();
  });

  it('disabled 時 enter／drop 皆 no-op', () => {
    const onFile = vi.fn();
    const { result, stop } = run({ onFile, disabled: true });
    result.dropHandlers.dragenter(dragEvent().event);
    expect(result.dragActive.value).toBe(false);
    result.dropHandlers.drop(dragEvent({ files: [{ name: 'x.json' }] }).event);
    expect(onFile).not.toHaveBeenCalled();
    stop();
  });

  it('非檔拖曳（types 無 Files）→ 不啟用', () => {
    const { result, stop } = run({ onFile: vi.fn() });
    const enter = dragEvent({ types: ['text/plain'] });
    result.dropHandlers.dragenter(enter.event);
    expect(result.dragActive.value).toBe(false);
    expect(enter.preventDefault).not.toHaveBeenCalled();
    stop();
  });
});
