// Словарь причин экрана `/auth/error` (S20): что считается известным кодом,
// что уходит в отчёт.
import { describe, it, expect } from 'vitest';
import {
  authErrorText,
  knownAuthErrorReason,
  reportedAuthErrorReason,
} from './authErrorReasons';

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
      expect(authErrorText(code), code).toBeTruthy();
    }
    expect(authErrorText('http_403')).toBeNull();
    expect(authErrorText(null)).toBeNull();
    expect(authErrorText('toString')).toBeNull();
  });

  // Яндекс ID (2026-11) — те же два кода, что у ВКонтакте: сбой входа
  // (`yandex_failed`) и рубильник (`yandex_disabled`), с именем своего сервиса.
  it('yandex_failed — называет Яндекс и зовёт к другому способу', () => {
    expect(authErrorText('yandex_failed')).toBe('Вход через Яндекс не прошёл. Можно повторить попытку или выбрать другой способ.');
  });

  // Почтой на сайт не входят: другой вход при рубильнике — второй сервис.
  it('yandex_disabled зовёт войти через VK ID', () => {
    expect(authErrorText('yandex_disabled')).toBe('Вход через Яндекс временно отключён. Если к аккаунту привязан VK ID, войти можно через него.');
  });

  it('vk_disabled зовёт к Яндекс ID; про почту ни слова', () => {
    expect(authErrorText('vk_disabled')).toBe('Вход через ВКонтакте временно отключён. Если к аккаунту привязан Яндекс ID, войти можно через него.');
    for (const code of ['vk_disabled', 'yandex_disabled']) expect(authErrorText(code)).not.toMatch(/почт/);
  });

  it('сбой входа Яндекса и ВКонтакте различается только именем сервиса', () => {
    expect(authErrorText('yandex_failed')).toBe(authErrorText('vk_failed')!.replace('ВКонтакте', 'Яндекс'));
  });
});
