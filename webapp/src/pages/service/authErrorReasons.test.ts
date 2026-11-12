// Словарь причин экрана `/auth/error` (S20): что считается известным кодом,
// что уходит в отчёт.
import { describe, it, expect } from 'vitest';
import {
  authErrorText,
  knownAuthErrorReason,
  reportedAuthErrorReason,
} from './authErrorReasons';

const ty = (a: string) => a;

describe('knownAuthErrorReason', () => {
  it.each(['vk_failed', 'max_failed', 'email_link_expired', 'email_network', 'http_401', 'http_503'])(
    '%s — известный код',
    (code) => expect(knownAuthErrorReason(code)).toBe(code),
  );

  it.each(['', 'unknown', 'yandex_failed', 'telegram_failed', 'telegram_expired', 'http_99', 'http_4011', 'http_abc', 'toString', '__proto__', 'Позвоните нам'])(
    '«%s» — не код',
    (raw) => expect(knownAuthErrorReason(raw)).toBeNull(),
  );
});

describe('reportedAuthErrorReason', () => {
  it('известный код — как есть, чужое — unknown, пусто — без отчёта', () => {
    expect(reportedAuthErrorReason('vk_failed')).toBe('vk_failed');
    expect(reportedAuthErrorReason('<script>')).toBe('unknown');
    expect(reportedAuthErrorReason(null)).toBeNull();
    expect(reportedAuthErrorReason('')).toBeNull();
  });
});

describe('authErrorText', () => {
  it('у каждого кода словаря есть текст; у неизвестного — нет', () => {
    for (const code of ['vk_failed', 'max_failed', 'email_link_expired', 'email_network', 'http_429', 'http_502']) {
      expect(authErrorText(code, ty), code).toBeTruthy();
    }
    expect(authErrorText('http_403', ty)).toBeNull();
    expect(authErrorText(null, ty)).toBeNull();
  });
});
