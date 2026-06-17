// 去個資（PII）遮蔽：開發者動作記錄 detail 的縱深防禦（08 §8.9）。
// detail 慣例僅含識別碼（如 patientId UUID）；此為防呼叫端不慎帶入結構化個資的最後防線。
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const ROC_ID_PATTERN = /\b[A-Z][12]\d{8}\b/g;
const TW_MOBILE_PATTERN = /\b09\d{8}\b/g;

export function redactPii(text: string): string {
  return text
    .replace(EMAIL_PATTERN, '[已遮蔽:電子郵件]')
    .replace(ROC_ID_PATTERN, '[已遮蔽:身分證]')
    .replace(TW_MOBILE_PATTERN, '[已遮蔽:電話]');
}
