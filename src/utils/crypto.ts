import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Logger } from '@nestjs/common';
import { HEX_KEY_RE, KEYS } from './crypto-keys';

// Multi-key support for online key rotation (разбор env — crypto-keys.ts).
// During rotation: add new key as ENCRYPTION_KEY, move previous to OLD, run
// `npm run rotate-encryption`. After it finishes, remove ENCRYPTION_KEY_OLD.
const { current: CURRENT_KEY, all: ALL_KEYS } = KEYS;

// Старый ключ, молча отброшенный из-за опечатки, — это нечитаемые данные после
// ротации. В проде такой ENCRYPTION_KEY_OLD роняет бут, как и битый текущий.
if (process.env.NODE_ENV === 'production') {
  const bad = (process.env.ENCRYPTION_KEY_OLD ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !HEX_KEY_RE.test(s));
  if (bad.length > 0)
    throw new Error(
      `FATAL: ENCRYPTION_KEY_OLD содержит ключи не в формате 64 hex-символа (${bad.length} шт.) — ` +
        'такой ключ молча не использовался бы для расшифровки.',
    );
}

// Fail loudly in production if no key is configured — silently storing
// sensitive psychology notes in plaintext is unacceptable.
if (process.env.NODE_ENV === 'production' && !CURRENT_KEY) {
  // Throwing at module-load time means the process crashes on boot, which
  // is what we want — better than running with broken encryption.
  throw new Error(
    'FATAL: ENCRYPTION_KEY missing or malformed (need exactly 64 hex chars) in production. ' +
      "Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

export function encrypt(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  if (!CURRENT_KEY) {
    if (process.env.NODE_ENV === 'production')
      throw new Error(
        'ENCRYPTION_KEY is not configured — refusing to store plaintext',
      );
    return text;
  }
  const iv = randomBytes(12);
  // authTagLength: 16 — defense in depth. GCM допускает тэги 4–16 байт;
  // явное пиннование к 16 не даёт случайно ослабить аутентификацию.
  const cipher = createCipheriv('aes-256-gcm', CURRENT_KEY, iv, {
    authTagLength: 16,
  });
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * Итог попытки расшифровать значение. `looksCipher` при провале: значение
 * ПОХОЖЕ на наш шифротекст (строгий base64 ≥29 байт), но ни один ключ не
 * подошёл — порча, подделка либо недокатившаяся ротация. Обычный текст
 * (легаси plaintext, кириллица, пробелы) даёт `looksCipher: false`.
 */
export type DecryptAttempt =
  { ok: true; text: string } | { ok: false; looksCipher: boolean };

/**
 * Расшифровка без побочных эффектов: ничего не логирует и не подменяет
 * провал самим значением. Вызывающий решает, что значит «не вышло» (массив →
 * [] с маркером, строка → сырое значение, проба самопроверки → счётчик).
 */
export function tryDecrypt(value: string | null | undefined): DecryptAttempt {
  if (!value || ALL_KEYS.length === 0) return { ok: false, looksCipher: false };
  let buf: Buffer;
  try {
    buf = Buffer.from(value, 'base64');
    if (buf.length < 29) return { ok: false, looksCipher: false }; // not encrypted format
  } catch {
    return { ok: false, looksCipher: false };
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  // Try each known key — current first, then old keys.
  for (const key of ALL_KEYS) {
    try {
      // authTagLength: 16 — отбрасывать тэги короче 16 байт; здесь tag всегда
      // subarray(12,28) = 16, но явный опшен закрепляет контракт (semgrep
      // gcm-no-tag-length / defense in depth).
      const decipher = createDecipheriv('aes-256-gcm', key, iv, {
        authTagLength: 16,
      });
      decipher.setAuthTag(tag);
      const text =
        decipher.update(data).toString('utf8') + decipher.final('utf8');
      return { ok: true, text };
    } catch {
      /* wrong key, try next */
    }
  }
  return { ok: false, looksCipher: looksLikeCiphertext(value) };
}

export function decrypt(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const r = tryDecrypt(value);
  if (r.ok) return r.text;
  // Ни один ключ не подошёл. Если blob ПОХОЖ на наш шифротекст — это порча/
  // подделка (провал GCM) или недокатившаяся ротация: молчать нельзя (аудит
  // 2026-07, S-3), алерт уровня error (D-8, аудит 2026-10 — AlertLogger шлёт
  // DM владельцу). Обычный текст с пробелами/кириллицей/«@» base64 не
  // является — это легаси plaintext, он читается тихо, иначе каждая старая
  // строка была бы ложной тревогой. Контракт «при провале вернуть value» —
  // на нём стоят encrypt-if-plain, волны дошифровки и ротация.
  if (r.looksCipher) logDecryptFailure();
  return value; // legacy plaintext (или мусор) — возвращаем как есть
}

// «Похоже на наш шифротекст»: строгий base64 + длина ≥29 байт (iv 12 + tag 16 +
// ≥1 байт данных). Строже проверки внутри decrypt() (она мягкая, по длине).
// GCM-тэг не проверяется: отличить шифротекст от plaintext, случайно
// похожего на base64, нельзя — вызывающий трактует «похоже + decrypt не
// сработал» как «неизвестно, не трогать» (см. classify в encrypt-migration.rows.ts).
const STRICT_BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

export function looksLikeCiphertext(value: string | null | undefined): boolean {
  if (!value) return false;
  if (value.length % 4 !== 0) return false;
  if (!STRICT_BASE64_RE.test(value)) return false;
  try {
    return Buffer.from(value, 'base64').length >= 29;
  } catch {
    return false;
  }
}

// Троттлинг: не чаще раза в минуту — массовое чтение порченых строк не должно
// заливать логи. В сообщении нет ни шифротекста, ни расшифрованного текста.
const logger = new Logger('Crypto');
let lastDecryptLogAt = 0;
function logDecryptFailure(): void {
  const now = Date.now();
  if (now - lastDecryptLogAt < 60_000) return;
  lastDecryptLogAt = now;
  // Logger, не console: так сообщение проходит через AlertLogger (error → DM).
  logger.error(
    '[crypto] decrypt: blob в формате шифротекста не расшифровался ни одним ключом — ' +
      'возможна порча данных или неполная ротация ENCRYPTION_KEY',
  );
}

// Re-encrypt with the CURRENT key. Used by rotation script — pass any
// encrypted blob, get back a blob encrypted with the new key. Returns the
// input unchanged if it can't be decrypted (plaintext or unknown key).
export function reencrypt(value: string | null | undefined): string | null {
  if (!value || !CURRENT_KEY) return value ?? null;
  const decrypted = decrypt(value);
  if (decrypted === null || decrypted === value) return value;
  return encrypt(decrypted);
}

// For JSON fields stored as encrypted string
export function encryptJson(val: unknown): string | null {
  if (val == null) return null;
  return encrypt(JSON.stringify(val));
}

export function decryptJson<T>(val: string | null | undefined): T | null {
  const s = decrypt(val);
  if (s == null) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

// Схема записи (encryptRecord/decryptRecord) живёт в crypto-record.ts; здесь —
// ре-экспорт, чтобы импортёры не менялись. Цикл crypto ↔ crypto-record
// безопасен: crypto-record берёт tryDecrypt/encrypt только при вызове.
export type { EncryptSchema } from './crypto-record';
export {
  decryptRecord,
  encryptRecord,
  unreadableFields,
} from './crypto-record';
