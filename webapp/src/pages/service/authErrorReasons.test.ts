// Словарь причин экрана `/auth/error` (S20): что считается известным кодом,
// что уходит в отчёт, как ответ сервера виджета Telegram превращается в код.
import { describe, it, expect } from 'vitest';
import {
  authErrorText,
  knownAuthErrorReason,
  reportedAuthErrorReason,
  telegramWidgetReason,
} from './authErrorReasons';

const ty = (a: string) => a;

describe('knownAuthErrorReason', () => {
  it.each(['google_failed', 'vk_failed', 'max_failed', 'telegram_failed', 'email_link_expired', 'email_network', 'telegram_no_data', 'http_401', 'http_503'])(
    '%s — известный код',
    (code) => expect(knownAuthErrorReason(code)).toBe(code),
  );

  it.each(['', 'unknown', 'yandex_failed', 'http_99', 'http_4011', 'http_abc', 'toString', '__proto__', 'Позвоните нам'])(
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
    for (const code of ['google_failed', 'telegram_expired', 'email_link_expired', 'email_network', 'http_429', 'http_502']) {
      expect(authErrorText(code, ty), code).toBeTruthy();
    }
    expect(authErrorText('http_403', ty)).toBeNull();
    expect(authErrorText(null, ty)).toBeNull();
  });
});

describe('telegramWidgetReason', () => {
  it('устаревшие данные — telegram_expired, остальное — код статуса без текста сервера', () => {
    expect(telegramWidgetReason(401, 'Telegram auth data expired')).toBe('telegram_expired');
    expect(telegramWidgetReason(401, 'Invalid Telegram signature')).toBe('http_401');
    expect(telegramWidgetReason(429, undefined)).toBe('http_429');
  });
});

// Рубильник Google/VK (2026-11): сервер ведёт сюда со старта входа, когда env
// провайдера снят (`src/auth/oauth-provider-switch.ts`). Текст безличный:
// экран публичный, формы обращения у него нет.
describe('провайдер выключен (<id>_disabled)', () => {
  const vy = (_: string, b: string) => b;
  it.each([
    ['google_disabled', 'Google'],
    ['vk_disabled', 'ВКонтакте'],
  ])('%s — известный код, текст про %s и другой способ, одинаковый в обеих формах', (code, name) => {
    expect(knownAuthErrorReason(code)).toBe(code);
    const text = authErrorText(code, ty);
    expect(text).toContain(`Вход через ${name} временно отключён`);
    expect(text).toContain('Telegram или почта');
    expect(authErrorText(code, vy)).toBe(text);
  });
});
