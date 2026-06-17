// shared 的 lib 僅 ES2023（無 DOM／Node 型別）；crypto 全域於瀏覽器、Node ≥19、vitest 皆存在。
// randomUUID 僅「安全環境」（HTTPS／localhost）可用——iOS WebKit 經 http://區網IP 存取時為
// undefined（故新增個案存檔擲錯）；getRandomValues 於非安全環境亦可用，留作後備。
declare const crypto: {
  randomUUID?: () => string;
  getRandomValues<T extends Uint8Array>(array: T): T;
};

// 系統識別碼一律 UUID（06 §6.6）：未來上傳 PostgreSQL 不與他機衝突。
// 優先用原生 randomUUID；非安全環境不可用時以 getRandomValues 產生 RFC 4122 v4 UUID。
export function createUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return uuidV4FromRandomBytes();
}

function uuidV4FromRandomBytes(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

const DISPLAY_CODE_PATTERN = /^P(\d{4,})$/;

// 人類可讀代碼自動編號（06 §6.2、§6.6）：P0001 起、取既有最大值 +1；
// 非本格式的自訂代碼不參與編號
export function nextDisplayCode(existingCodes: readonly (string | undefined)[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const match = code === undefined ? null : DISPLAY_CODE_PATTERN.exec(code);
    if (match !== null) max = Math.max(max, Number(match[1]));
  }
  return `P${String(max + 1).padStart(4, '0')}`;
}
