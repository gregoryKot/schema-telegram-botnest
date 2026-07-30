// @vitest-environment jsdom
// Разводит «не входил» (web) от «сессия истекла» (Telegram/MAX) — см. App.tsx,
// ветка рендера ошибки. Инцидент: браузер без initData и без refresh-куки
// ловил 401 и видел текст «Сессия истекла», хотя вообще не входил.
//
// getHost() определяет хост живым чтением window.Telegram/window.WebApp
// (см. shared/src/host/index.ts) — поэтому хост здесь мокается теми же
// глобалами, что и shared/src/host/host.test.ts, а не через setHost()
// (setHost хранит инстанс, но getHost() всё равно перепроверяет detectHostId()
// и пересоздаст хост, если глобалы ему не соответствуют).
import { describe, it, expect, beforeEach } from 'vitest';
import { setHost } from '../../../shared/src/host';
import { shouldShowLoginScreen } from './loginScreenGate';

beforeEach(() => {
  setHost(null);
  delete (globalThis as { Telegram?: unknown }).Telegram;
  delete (globalThis as { WebApp?: unknown }).WebApp;
});

describe('shouldShowLoginScreen', () => {
  it('в браузере (нет window.Telegram/WebApp) — экран входа', () => {
    expect(shouldShowLoginScreen()).toBe(true);
  });

  it('в Telegram — не экран входа (там прежний AppErrorScreen)', () => {
    (globalThis as { Telegram?: unknown }).Telegram = {
      WebApp: { initData: 'hash=abc' },
    };
    expect(shouldShowLoginScreen()).toBe(false);
  });

  it('в MAX — не экран входа', () => {
    (globalThis as { WebApp?: unknown }).WebApp = {
      initData: 'query_id=abc',
    };
    expect(shouldShowLoginScreen()).toBe(false);
  });
});
