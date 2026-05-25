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
    .split(',').map(s => s.trim()).filter(Boolean)
    .map(parse).filter((k): k is Buffer => k !== null);
  const all = [cur, ...olds].filter((k): k is Buffer => k !== null);
  return { current: cur, all };
}
const { current: CURRENT_KEY, all: ALL_KEYS } = loadKeys();

export function encrypt(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  if (!CURRENT_KEY) {
    if (process.env.NODE_ENV === 'production') throw new Error('ENCRYPTION_KEY is not configured — refusing to store plaintext');
    return text;
  }
  const iv = randomBytes(12);
  // authTagLength: 16 — defense in depth. GCM допускает тэги 4–16 байт;
  // явное пиннование к 16 не даёт случайно ослабить аутентификацию.
  const cipher = createCipheriv('aes-256-gcm', CURRENT_KEY, iv, { authTagLength: 16 });
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
      const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
      decipher.setAuthTag(tag);
      return decipher.update(data).toString('utf8') + decipher.final('utf8');
    } catch { /* wrong key, try next */ }
  }
  return value; // none worked — legacy plaintext, return as-is
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
  try { return JSON.parse(s) as T; } catch { return null; }
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
  strings?: string[];    // fields to encrypt/decrypt as plain strings
  jsonArrays?: string[]; // fields to encrypt/decrypt as JSON-encoded arrays
}

export function encryptRecord<T extends Record<string, unknown>>(data: T, schema: EncryptSchema): T {
  const out: any = { ...data };
  for (const f of schema.strings ?? []) {
    if (out[f] != null) out[f] = encrypt(String(out[f]));
  }
  for (const f of schema.jsonArrays ?? []) {
    if (out[f] != null) out[f] = encryptJson(out[f]) ?? JSON.stringify(out[f]);
  }
  return out;
}

export function decryptRecord<T extends Record<string, unknown>>(row: T, schema: EncryptSchema): T {
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
