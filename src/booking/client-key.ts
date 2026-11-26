// Ключ клиента для ClientMeeting (одна строка = одна постоянная комната).
//
// Аудит 2026-10 (docs/open/security.md): ключ был несолёным sha256 контакта,
// из которого у ЛЮБОГО контакта стирались `-`, `+` и скобки. Отсюда две беды:
// разные ящики склеивались (`ivan-petrov@x.ru` ≡ `ivanpetrov@x.ru`,
// `name+tag@x.ru` ≡ `nametag@x.ru`) — бронь с «похожим» ящиком получала
// комнату другого клиента; а по утёкшему дампу ключ перебирался словарём
// телефонов и ников — база отвечала, записывался ли человек, даже после
// обезличивания брони. Теперь нормализация зависит от формы контакта, а ключ —
// HMAC с серверным секретом. Старые строки переводит client-key-rekey.service.ts.
// Нормальная форма контакта — contact-normal-form.ts.

import { createHash } from 'crypto';
import { keyedDigests } from '../utils/crypto-keys';
import { digitsOnlyForm, normalizeContact } from './contact-normal-form';

export { normalizeContact };

const LABEL = 'clientMeeting.clientKey.v1';
const sha256 = (s: string): string =>
  createHash('sha256').update(s).digest('hex');

/**
 * Ключи контакта: под текущим ENCRYPTION_KEY первым (`k1:`), затем под каждым
 * ENCRYPTION_KEY_OLD — окно ротации, пока строки не перенесены. Без ключа
 * (dev, юнит-тесты; прод без ключа не стартует, utils/crypto.ts) — `k0:` от
 * sha256: подменять секрет нечем.
 */
export function clientKeyCandidates(contact: string): string[] {
  const norm = normalizeContact(contact);
  const { current, all } = keyedDigests(LABEL, norm);
  if (!current) return [`k0:${sha256(norm)}`];
  return [...new Set(all.map((d) => `k1:${d}`))];
}

/** Ключ строки ClientMeeting для нового контакта. */
export function clientKey(contact: string): string {
  return clientKeyCandidates(contact)[0];
}

/** Старая формула (до аудита 2026-10) — только для перевода строк на новый ключ. */
export function legacyClientKey(contact: string): string {
  const norm = contact
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[\s()+-]/g, '');
  return sha256(norm);
}

/** Строка в старом формате: голые 64 hex, без префикса версии. */
export const isLegacyKey = (key: string): boolean => /^[0-9a-f]{64}$/.test(key);

/**
 * Ключи, под которыми строку этого контакта мог записать прежний код: старая
 * формула, ключи под ENCRYPTION_KEY_OLD и `k0:` (строка, записанная без ключа).
 * Только для прохода client-key-rekey.service.ts: поиск по старой формуле
 * вернул бы склейку ящиков.
 */
export function clientKeySources(contact: string): string[] {
  const [current, ...olds] = clientKeyCandidates(contact);
  const k0 = `k0:${sha256(normalizeContact(contact))}`;
  const extra = current === k0 ? [] : [k0];
  // Строки, записанные до сохранения `+` у телефона (под каждым ключом и k0).
  const digits = digitsOnlyForm(contact);
  const prior =
    digits === null
      ? []
      : [...clientKeyCandidates(digits), `k0:${sha256(digits)}`];
  return [...new Set([legacyClientKey(contact), ...olds, ...extra, ...prior])];
}
