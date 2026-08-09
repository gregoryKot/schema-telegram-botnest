// @vitest-environment jsdom
// Стык «загрузчик моста → определение хоста». Именно его не было, когда
// сломался вход (инцидент 2026-08-08).
//
// Тесты по обе стороны шва существовали и были зелёными:
//   • `shared/src/host/host.test.ts` проверял detectHostId() на РУКАМИ
//     поставленном window.WebApp — то есть на допущении «этот объект бывает
//     только в MAX»;
//   • загрузчик `webapp/public/max-bridge.js` не проверял никто.
// Ошибка жила ровно между ними: загрузчик создавал window.WebApp внутри
// Telegram, и допущение переставало быть верным. Тест ниже проходит весь путь
// целиком — настоящий адрес запуска, настоящий файл загрузчика, настоящий
// детектор — и потому ловит то, что не ловят обе половины по отдельности.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectHostId, getHost, setHost } from '../../shared/src/host';
import { resetMaxLaunchParams } from '../../shared/src/host/max';

const LOADER = readFileSync(
  resolve(__dirname, '../public/max-bridge.js'),
  'utf8',
);

/** Фрагмент адреса, с которым Telegram открывает мини-апп. */
const TELEGRAM_HASH =
  '#tgWebAppData=user%3D%257B%2522id%2522%253A777%257D%26hash%3Dabc' +
  '&tgWebAppVersion=8.0&tgWebAppPlatform=ios';

/** Фрагмент адреса, с которым мини-апп открывает MAX. */
const MAX_HASH =
  '#WebAppData=auth_date%3D1%26hash%3Dabc&WebAppPlatform=ios';

/**
 * Прогон реального загрузчика. `document.write` не эмулируем построчно:
 * важно лишь, дошло ли дело до подключения моста — если дошло, их скрипт
 * создаёт глобаль window.WebApp (проверено на живом st.max.ru: `window.WebApp = b`).
 */
function runLoaderAndLoadBridge(): boolean {
  let requested = false;
  const documentStub = {
    write: (html: string) => {
      requested = html.includes('max-web-app.js');
    },
  };
  new Function('window', 'document', LOADER)(window, documentStub);
  if (requested) {
    (globalThis as { WebApp?: unknown }).WebApp = {
      initData: '',
      initDataUnsafe: {},
      BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
    };
  }
  return requested;
}

/** Телеграмный SDK подключён в index.html безусловно и живёт в любом окружении. */
function loadTelegramSdk(opts: { insideTelegram: boolean }) {
  (globalThis as { Telegram?: unknown }).Telegram = {
    WebApp: opts.insideTelegram
      ? { platform: 'ios', initData: 'user=%7B%22id%22%3A777%7D&hash=abc' }
      : { platform: 'unknown', initData: '' },
  };
}

beforeEach(() => {
  setHost(null);
  delete (globalThis as { Telegram?: unknown }).Telegram;
  delete (globalThis as { WebApp?: unknown }).WebApp;
});

afterEach(() => {
  window.location.hash = '';
  resetMaxLaunchParams();
  setHost(null);
});

describe('запуск из Telegram', () => {
  beforeEach(() => {
    window.location.hash = TELEGRAM_HASH;
    resetMaxLaunchParams();
  });

  it('мост MAX не подключается', () => {
    expect(runLoaderAndLoadBridge()).toBe(false);
  });

  it('хост — Telegram, и обмен идёт телеграмным эндпоинтом с непустой подписью', () => {
    loadTelegramSdk({ insideTelegram: true });
    runLoaderAndLoadBridge();

    expect(detectHostId()).toBe('telegram');
    const exchange = getHost().sessionExchange();
    expect(exchange?.path).toBe('/api/auth/telegram/webapp');
    expect(exchange?.body.initData).not.toBe('');
  });

  // Пустая подпись — это и есть тот 401, который увидели пользователи: хост
  // определился чужой, а его подписи в телеграмном запуске взяться неоткуда.
  it('даже если мост всё-таки появился, пустая MAX-подпись не перебивает Telegram', () => {
    loadTelegramSdk({ insideTelegram: true });
    (globalThis as { WebApp?: unknown }).WebApp = { initData: '' };

    expect(detectHostId()).toBe('telegram');
  });
});

describe('запуск из MAX', () => {
  beforeEach(() => {
    window.location.hash = MAX_HASH;
    resetMaxLaunchParams();
  });

  it('мост подключается, хост — MAX', () => {
    expect(runLoaderAndLoadBridge()).toBe(true);
    loadTelegramSdk({ insideTelegram: false });

    expect(detectHostId()).toBe('max');
  });

  it('мост не доехал (CDN недоступен) — вход всё равно идёт по подписи из адреса', () => {
    loadTelegramSdk({ insideTelegram: false });

    expect(detectHostId()).toBe('max');
    expect(getHost().sessionExchange()?.path).toBe('/api/auth/max/webapp');
  });
});

describe('обычная вкладка браузера', () => {
  it('ни один мессенджер не опознаётся, мост не грузится', () => {
    window.location.hash = '';
    resetMaxLaunchParams();
    loadTelegramSdk({ insideTelegram: false });

    expect(runLoaderAndLoadBridge()).toBe(false);
    expect(detectHostId()).toBe('web');
  });
});
