// 全 APP 共用動作記錄（02 §2.11、07 §7.6）：dev 模式輸出至瀏覽器 console、正式建置 no-op。
// 呼叫點不需條件包裹：正式建置 singleton 為 no-op。
import { redactPii } from './redactPii';

export interface ActionLogger {
  log(module: string, action: string, detail?: string): void;
  warn(module: string, action: string, detail?: string): void;
  error(module: string, action: string, detail?: string): void;
}

type ConsoleSink = Pick<Console, 'log' | 'warn' | 'error'>;

function formatLine(module: string, action: string, detail?: string): string {
  const head = `[${module}] ${action}`;
  return detail === undefined ? head : `${head} — ${redactPii(detail)}`;
}

export function createConsoleActionLogger(out: ConsoleSink = console): ActionLogger {
  return {
    log: (module, action, detail) => out.log(formatLine(module, action, detail)),
    warn: (module, action, detail) => out.warn(formatLine(module, action, detail)),
    error: (module, action, detail) => out.error(formatLine(module, action, detail)),
  };
}

export function createNoopActionLogger(): ActionLogger {
  return { log: () => {}, warn: () => {}, error: () => {} };
}

// 旗標經 vite.define 靜態替換後 dead branch 可消除（02 §2.11）
export const actionLogger: ActionLogger =
  import.meta.env.VITE_DEV_MODE === 'true' ? createConsoleActionLogger() : createNoopActionLogger();

// 正式建置隔離哨兵（08 §8.9 verifyProdBundle）：dev-only 記錄路徑標記。
// VITE_DEV_MODE 建置期靜態替換 → 正式建置此 dead branch 連同字串整段剔除，dist 不含 ptappDevLoggerMarker。
if (import.meta.env.VITE_DEV_MODE === 'true') {
  (globalThis as Record<string, unknown>).__ptappDevLoggerMarker = 'ptappDevLoggerMarker';
}
