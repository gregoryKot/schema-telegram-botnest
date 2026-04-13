import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const RAW = process.env.ENCRYPTION_KEY ?? '';
const KEY = RAW.length === 64 ? Buffer.from(RAW, 'hex') : null; // 32 bytes = AES-256

export function encrypt(text: string | null | undefined): string | null {
  if (!text || !KEY) return text ?? null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(value: string | null | undefined): string | null {
  if (!value || !KEY) return value ?? null;
  try {
    const buf = Buffer.from(value, 'base64');
    // Minimum: 12 (iv) + 16 (tag) + 1 (data) = 29 bytes
    if (buf.length < 29) return value;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data).toString('utf8') + decipher.final('utf8');
  } catch {
    return value; // legacy plaintext — return as-is
  }
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
