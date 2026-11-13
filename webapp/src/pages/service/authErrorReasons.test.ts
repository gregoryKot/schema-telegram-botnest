// Словарь причин экрана `/auth/error` (S20): что считается известным кодом,
// что уходит в отчёт.
import { describe, it, expect } from 'vitest';
import {
  authErrorText,
  knownAuthErrorReason,
  reportedAuthErrorReason,
} from './authErrorReasons';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;

describe('knownAuthErrorReason', () => {
  it.each(['vk_failed', 'vk_disabled', 'yandex_failed', 'yandex_disabled', 'max_failed', 'email_link_expired', 'email_network', 'http_401', 'http_503'])(
    '%s — известный код',
    (code) => expect(knownAuthErrorReason(code)).toBe(code),
  );

  it.each(['', 'unknown', 'yandex', 'yandex_expired', 'google_failed', 'telegram_failed', 'telegram_expired', 'http_99', 'http_4011', 'http_abc', 'toString', '__proto__', 'Позвоните нам'])(
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
    for (const code of ['vk_failed', 'yandex_failed', 'yandex_disabled', 'max_failed', 'email_link_expired', 'email_network', 'http_429', 'http_502']) {
      expect(authErrorText(code, ty), code).toBeTruthy();
    }
    expect(authErrorText('http_403', ty)).toBeNull();
    expect(authErrorText(null, ty)).toBeNull();
  });

  // Яндекс ID (2026-11) — те же два кода, что у ВКонтакте: сбой входа
  // (`yandex_failed`) и рубильник (`yandex_disabled`), с именем своего сервиса.
  it('yandex_failed — в обеих формах обращения, называет Яндекс', () => {
    expect(authErrorText('yandex_failed', ty)).toBe('Вход через Яндекс не прошёл. Попробуй ещё раз или выбери другой способ.');
    expect(authErrorText('yandex_failed', vy)).toBe('Вход через Яндекс не прошёл. Попробуйте ещё раз или выберите другой способ.');
  });

  it('yandex_disabled — безличный: одна строка для «ты» и «вы», зовёт войти почтой', () => {
    const text = authErrorText('yandex_disabled', ty);
    expect(text).toBe('Вход через Яндекс временно отключён. Другой способ — почта: если она привязана к аккаунту, откроется он же.');
    expect(authErrorText('yandex_disabled', vy)).toBe(text);
  });

  it('тексты Яндекса и ВКонтакте различаются только именем сервиса', () => {
    for (const kind of ['failed', 'disabled']) {
      expect(authErrorText(`yandex_${kind}`, vy)).toBe(authErrorText(`vk_${kind}`, vy)!.replace('ВКонтакте', 'Яндекс'));
    }
  });
});
