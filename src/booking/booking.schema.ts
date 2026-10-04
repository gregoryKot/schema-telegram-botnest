import type { EncryptSchema } from '../utils/crypto';

// Единственное описание того, какие поля Booking лежат в БД зашифрованными
// (AES-256-GCM через encryptRecord/decryptRecord, см. utils/crypto.ts). Раньше
// схема была продублирована в booking.service.ts и booking-notify.service.ts —
// два места, обязанные совпадать (правило №4 CLAUDE.md), теперь один модуль.
//
// meetingUrl (D-9, аудит 2026-10): ссылка на Zoom несёт `?pwd=` — по ней можно
// войти в комнату клиента, поэтому она шифруется так же, как контакт. По ссылке
// никогда не ищут (поиск — по id/cancelToken), так что шифрование ничего не
// ломает. Старые строки с открытой ссылкой читаются как есть (decrypt
// терпим к plaintext) и дошифровываются волной encryption-wave3.service.ts.
export const BOOKING_SCHEMA: EncryptSchema = {
  strings: ['clientName', 'clientContact', 'message', 'meetingUrl'],
};
