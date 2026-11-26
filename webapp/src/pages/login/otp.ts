export const OTP_LENGTH = 6;

/** Код из приложения — только цифры, не больше шести (вставка «123 456» тоже). */
export function normalizeOtp(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
}
