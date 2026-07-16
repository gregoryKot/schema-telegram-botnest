import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Multi-key support for online key rotation:
//   ENCRYPTION_KEY     — current key, used for ALL new encryption
//   ENCRYPTION_KEY_OLD — comma-separated old keys, tried on decryption only
// During rotation: add new key as ENCRYPTION_KEY, move previous to OLD, run
// `npm run rotate-encryption`. After it finishes, remove ENCRYPTION_KEY_OLD.
function loadKeys(): { current: Buffer | null; all: Buffer[] } {
  const parse = (hex: string): Buffer | null =>
    hex.length === 64 ? Buffer.from(hex, 'hex') : null;
  const cur = parse((process.env.ENCRYPTION_KEY ?? '').trim());
  const olds = (process.env.ENCRYPTION_KEY_OLD ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parse)
    .filter((k): k is Buffer => k !== null);
  const all = [cur, ...olds].filter((k): k is Buffer => k !== null);
  return { current: cur, all };
}
const { current: CURRENT_KEY, all: ALL_KEYS } = loadKeys();

// Fail loudly in production if no key is configured — silently storing
// sensitive psychology notes in plaintext is unacceptable.
if (process.env.NODE_ENV === 'production' && !CURRENT_KEY) {
  // Throwing at module-load time means the process crashes on boot, which
  // is what we want — better than running with broken encryption.
  throw new Error(
    'FATAL: ENCRYPTION_KEY missing or wrong length in production. ' +
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

export function decrypt(value: string | null | undefined): string | null {
  if (!value || ALL_KEYS.length === 0) return value ?? null;
  let buf: Buffer;
  try {
    buf = Buffer.from(value, 'base64');
    if (buf.length < 29) return value; // not encrypted format
  } catch {
    return value;
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
      return decipher.update(data).toString('utf8') + decipher.final('utf8');
    } catch {
      /* wrong key, try next */
    }
  }
  // Ни один ключ не подошёл, хотя blob похож на наш формат (валидный base64
  // ≥29 байт). Это либо legacy plaintext, случайно похожий на base64, либо
  // ПОБИТЫЙ/ПОДДЕЛАННЫЙ шифротекст (провал GCM-аутентификации) — молчать
  // нельзя (аудит 2026-07, S-3). Троттлинг: не чаще раза в минуту, чтобы
  // массовое чтение легаси-строк не заливало логи.
  warnDecryptFailure();
  return value; // legacy plaintext (или мусор) — возвращаем как есть
}

// Strict base64 charset + minimum length check for "this looks like our
// ciphertext wire format" (iv 12 + tag 16 + ≥1 byte of data = ≥29 bytes).
// Deliberately stricter than the passthrough check inside decrypt() above
// (which uses the lenient Buffer.from(..., 'base64') decode and only checks
// length) — this is used by callers that need to distinguish "real plaintext"
// from "ciphertext whose key is no longer configured" BEFORE re-encrypting,
// see encrypt-migration.ts. Does not verify the GCM tag, so it can't tell
// ciphertext from a plaintext string that *happens* to be valid base64 of
// the right length — callers must treat a positive match plus a failed
// decrypt() as "unknown, do not touch", not as "definitely ciphertext".
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

let lastDecryptWarnAt = 0;
function warnDecryptFailure(): void {
  const now = Date.now();
  if (now - lastDecryptWarnAt < 60_000) return;
  lastDecryptWarnAt = now;
  // console, не Logger: utils-модуль без DI; AlertLogger перехватывает stdout уровня error/warn.
  console.warn(
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

// ── Record-level encryption ──────────────────────────────────────────────────
// Declare a schema once, use it for both write (encryptRecord) and read (decryptRecord).
// This ensures every field is always encrypted/decrypted consistently.
//
// Usage:
//   const MY_SCHEMA: EncryptSchema = { strings: ['text', 'reframe'], jsonArrays: ['items'] };
//   const row = await prisma.myModel.create({ data: encryptRecord(data, MY_SCHEMA) });
//   return decryptRecord(row, MY_SCHEMA);

export interface EncryptSchema {
  strings?: string[]; // fields to encrypt/decrypt as plain strings
  jsonArrays?: string[]; // fields to encrypt/decrypt as JSON-encoded arrays
}

export function encryptRecord<T extends Record<string, unknown>>(
  data: T,
  schema: EncryptSchema,
): T {
  const out: any = { ...data };
  for (const f of schema.strings ?? []) {
    if (out[f] != null) out[f] = encrypt(String(out[f]));
  }
  for (const f of schema.jsonArrays ?? []) {
    if (out[f] != null) out[f] = encryptJson(out[f]) ?? JSON.stringify(out[f]);
  }
  return out;
}

export function decryptRecord<T extends Record<string, unknown>>(
  row: T,
  schema: EncryptSchema,
): T {
  const out: any = { ...row };
  for (const f of schema.strings ?? []) {
    if (out[f] != null) out[f] = decrypt(String(out[f]));
  }
  for (const f of schema.jsonArrays ?? []) {
    if (out[f] == null) continue;
    // Forward-compat: if Prisma already deserialised the JSON column into an
    // array/object (legacy plaintext rows), return as-is. Only attempt
    // decrypt+parse when the column comes back as a string (new encrypted form).
    if (typeof out[f] === 'string') {
      out[f] = decryptJson(out[f]) ?? out[f];
    }
  }
  return out;
}
