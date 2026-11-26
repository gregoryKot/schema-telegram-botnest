import { decryptRecord, encryptRecord, EncryptSchema } from './crypto';

// Шифрование персональных полей AuthProvider (D-9, аудит 2026-10): email и
// имя из OAuth-профиля — это PII, а лежали открытым текстом. Лукап-ключ
// строки — (provider, providerId), по email/displayName не ищут никогда
// (для email-провайдера адрес остаётся открытым только как providerId —
// шифрование ломало бы findUnique, осознанный компромисс в FIELD_POLICY).
//
// Один модуль на запись и чтение: писатели живут в src/auth/**, читатели — в
// src/auth/**, src/account/** и волне дошифровки старых строк
// (src/prisma/encryption-wave3.service.ts). Чтение терпимо к plaintext
// (decrypt возвращает не-шифротекст как есть), поэтому старые строки
// читаются до дошифровки, а порядок выката не важен.
export const AUTH_PROVIDER_SCHEMA: EncryptSchema = {
  strings: ['email', 'displayName'],
};

/** Для `data` в create/update/upsert: шифрует email и displayName, остальное не трогает. */
export function encryptAuthProviderFields<T extends Record<string, unknown>>(
  data: T,
): T {
  return encryptRecord(data, AUTH_PROVIDER_SCHEMA);
}

/** Для строки, прочитанной из БД: расшифровывает email и displayName. */
export function decryptAuthProviderRow<T extends Record<string, unknown>>(
  row: T,
): T {
  return decryptRecord(row, AUTH_PROVIDER_SCHEMA);
}
