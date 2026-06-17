function pad2(value: number): string {
  return String(Math.trunc(Math.abs(value))).padStart(2, '0');
}

// ISO 8601 字串（含本地時區位移，06 §6.1），如 2026-06-12T09:30:00+08:00。
// Date.toISOString() 只輸出 UTC（Z），故自行組字串。
export function toIsoDateTime(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offset = `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}${offset}`
  );
}

// ISO 日期（匯出檔名等用），如 2026-06-12
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
