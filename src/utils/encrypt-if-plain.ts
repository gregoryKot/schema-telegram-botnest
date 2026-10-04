import { decrypt, encrypt, looksLikeCiphertext } from './crypto';

/**
 * Строка уже зашифрована или ПОХОЖА на шифротекст (тогда ключ, которым она
 * зашифрована, мог быть убран из конфигурации — трогать нельзя: повторное
 * шифрование сделало бы оригинал нечитаемым, см. encrypt-migration.ts).
 */
export function isEncryptedOrUnknown(v: string): boolean {
  return decrypt(v) !== v || looksLikeCiphertext(v);
}

/**
 * Шифрует строку, если она ещё открытая; пустое/null/уже шифрованное
 * возвращает как есть. Для волн дошифровки исторических строк.
 */
export function encryptIfPlain(v: string | null): string | null {
  if (!v || isEncryptedOrUnknown(v)) return v;
  return encrypt(v);
}
