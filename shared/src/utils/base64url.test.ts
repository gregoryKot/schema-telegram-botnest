import { describe, it, expect } from 'vitest';
import { base64UrlToBytes, base64UrlToText } from './base64url';

const toB64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

describe('base64UrlToBytes', () => {
  it('символы -/_ и строка без паддинга — те же байты, что закодированы', () => {
    // 0xfb 0xff дают «+/» в обычном base64 — проверка, что алфавит url-safe разбирается.
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf, 4, 0, 255, 128]);
    const encoded = toB64Url(bytes);
    expect(encoded).toMatch(/[-_]/);
    expect(encoded).not.toContain('=');
    expect([...base64UrlToBytes(encoded)]).toEqual([...bytes]);
  });

  it('65-байтовый ключ VAPID (несжатая точка P-256) — 65 байт, первый 0x04', () => {
    const key = new Uint8Array(65).map((_, i) => (i === 0 ? 4 : i));
    const decoded = base64UrlToBytes(toB64Url(key));
    expect(decoded).toHaveLength(65);
    expect(decoded[0]).toBe(4);
  });

  it('битая строка — исключение, а не тихий мусор', () => {
    expect(() => base64UrlToBytes('a')).toThrow();
  });
});

describe('base64UrlToText', () => {
  it('кириллица в UTF-8 разбирается целиком', () => {
    const bytes = new TextEncoder().encode('{"first_name":"Григорий"}');
    expect(base64UrlToText(toB64Url(bytes))).toBe('{"first_name":"Григорий"}');
  });
});
