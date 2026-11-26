import * as crypto from 'crypto';

export const EMAIL_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 min

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
