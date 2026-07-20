import { describe, it, expect } from 'vitest';
import { telemetryUrl } from './telemetryUrl';

// Регрессия аудита 2026-07-20 (H0): в краш-репорт клался location.href
// целиком, а во фрагменте URL живут ЖИВЫЕ креденшелы. Отсюда они уезжали в
// логи сервера и в DM админа.
describe('telemetryUrl', () => {
  it('срезает fragment с initData мини-аппа (подпись = реплей 1 ч)', () => {
    const href =
      'https://schemehappens.ru/app/#tgWebAppData=query_id%3DAAH%26user%3D%257B%2522id%2522%253A279058397%257D%26hash%3Dc501b71e775f74ce10e377dea85a7ea24ecd640b';
    const out = telemetryUrl(href);
    expect(out).toBe('https://schemehappens.ru/app/');
    expect(out).not.toContain('tgWebAppData');
    expect(out).not.toContain('hash');
  });

  it('срезает fragment с access-токеном вебаппа', () => {
    const out = telemetryUrl(
      'https://schemehappens.ru/auth/callback#access_token=eyJhbGciOiJIUzI1NiJ9.payload.SIG&expires_in=900',
    );
    expect(out).toBe('https://schemehappens.ru/auth/callback');
    expect(out).not.toContain('access_token');
    expect(out).not.toContain('SIG');
  });

  it('срезает query-строку (там тоже ездят токены)', () => {
    expect(telemetryUrl('https://schemehappens.ru/verify?token=magic')).toBe(
      'https://schemehappens.ru/verify',
    );
  });

  it('обычный путь сохраняется — телеметрия остаётся полезной', () => {
    expect(telemetryUrl('https://schemehappens.ru/app/therapy')).toBe(
      'https://schemehappens.ru/app/therapy',
    );
  });

  it('пустое/undefined → undefined', () => {
    expect(telemetryUrl(undefined)).toBeUndefined();
    expect(telemetryUrl('')).toBeUndefined();
    expect(telemetryUrl('#tgWebAppData=secret')).toBeUndefined();
  });

  it('длина ограничена 200 символами', () => {
    expect(telemetryUrl('https://x.ru/' + 'a'.repeat(500))!.length).toBe(200);
  });
});
