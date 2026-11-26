import type { EncryptSchema } from '../utils/crypto';

// Какие поля IntroLead лежат в БД зашифрованными (AES-256-GCM через
// encryptRecord/decryptRecord, utils/crypto.ts). Единственное описание: писатель
// (intro-lead.service.ts) и читатель повтора доставки берут схему отсюда.
// clientChannel и source — структурные данные, хранятся открыто.
export const INTRO_LEAD_SCHEMA: EncryptSchema = {
  strings: ['clientName', 'clientContact', 'message'],
};
