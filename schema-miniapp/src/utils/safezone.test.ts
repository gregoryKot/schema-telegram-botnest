// Регрессия: в полноэкранном режиме Telegram (fullscreen) текст и кнопки шапки
// оказывались ПОД плавающими кнопками Telegram, когда клиент не прислал
// contentSafeAreaInset. computeSafeTop обязан: (а) брать точное значение, когда
// клиент реально сообщил инсеты; (б) держать щедрую границу, когда не сообщил.
// См. баг «кнопки некликабельны / крестик закрывает текст» (июль 2026).
import { describe, it, expect } from 'vitest';
import { computeSafeTop } from './safezone';

const FS_BAND_IOS = 76;
const FS_BAND_ANDROID = 48;
const IOS_FULLSCREEN_MIN = 100;

describe('computeSafeTop — не-полноэкранный режим', () => {
  it('складывает device + content, когда инсеты пришли', () => {
    expect(
      computeSafeTop({
        contentTop: 20,
        deviceTop: 47,
        isFullscreen: false,
        ios: true,
        contentReported: true,
      }),
    ).toBe(67);
  });

  it('iOS без инсетов (contentTop не сообщён) — фолбэк 96', () => {
    expect(
      computeSafeTop({
        contentTop: undefined,
        deviceTop: undefined,
        isFullscreen: false,
        ios: true,
        contentReported: false,
      }),
    ).toBe(96);
  });

  it('не-iOS без инсетов — 0', () => {
    expect(
      computeSafeTop({
        contentTop: undefined,
        deviceTop: undefined,
        isFullscreen: false,
        ios: false,
        contentReported: false,
      }),
    ).toBe(0);
  });

  it('contentTop явно 0 — доверяем нулю, фолбэк не включаем даже на iOS', () => {
    expect(
      computeSafeTop({
        contentTop: 0,
        deviceTop: 0,
        isFullscreen: false,
        ios: true,
        contentReported: true,
      }),
    ).toBe(0);
  });
});

describe('computeSafeTop — fullscreen, инсеты РЕАЛЬНО пришли (точное значение)', () => {
  it('device + content, без лишнего отступа (notch)', () => {
    expect(
      computeSafeTop({
        contentTop: 46,
        deviceTop: 47,
        isFullscreen: true,
        ios: true,
        contentReported: true,
      }),
    ).toBe(93);
  });

  it('iPhone SE — маленький статус-бар не раздуваем', () => {
    // 20 + 46 = 66; фолбэк 100 НЕ применяется, т.к. клиент сообщил инсеты.
    expect(
      computeSafeTop({
        contentTop: 46,
        deviceTop: 20,
        isFullscreen: true,
        ios: true,
        contentReported: true,
      }),
    ).toBe(66);
  });
});

describe('computeSafeTop — fullscreen, инсеты НЕ пришли (щедрый фолбэк)', () => {
  it('device есть, content не сообщён: очищаем высокую полосу (device + 76)', () => {
    expect(
      computeSafeTop({
        contentTop: undefined,
        deviceTop: 47,
        isFullscreen: true,
        ios: true,
        contentReported: false,
      }),
    ).toBe(47 + FS_BAND_IOS);
  });

  it('content сообщён, но device НЕ пришёл — не доверяем частичным, фолбэк iOS', () => {
    // device 0 → real 40 недостаточно (нет статус-бара) → минимум iOS 100.
    expect(
      computeSafeTop({
        contentTop: 40,
        deviceTop: 0,
        isFullscreen: true,
        ios: true,
        contentReported: true,
      }),
    ).toBe(IOS_FULLSCREEN_MIN);
  });

  it('совсем без инсетов на iOS — минимум 100, не ноль и не 48', () => {
    const v = computeSafeTop({
      contentTop: undefined,
      deviceTop: undefined,
      isFullscreen: true,
      ios: true,
      contentReported: false,
    });
    expect(v).toBe(IOS_FULLSCREEN_MIN);
    expect(v).toBeGreaterThan(0);
  });

  it('Android без инсетов — полоса кнопок Android (48)', () => {
    expect(
      computeSafeTop({
        contentTop: undefined,
        deviceTop: undefined,
        isFullscreen: true,
        ios: false,
        contentReported: false,
      }),
    ).toBe(FS_BAND_ANDROID);
  });
});

// Четвёртый заход (скриншот 2026-08-12): в sheet-режиме Telegram рисует
// СПЛОШНУЮ шапку над webview — полоса контента честно нулевая, а страховка
// 96px давала дыру над заголовком. Правило: способному клиенту (полоса
// контента прислана, пусть и нулём) верим точно; страховка — только тем,
// кто полосу прислать не умеет (contentTop undefined, Bot API < 8.0).
describe('computeSafeTop — нулевые инсеты внутри мессенджера (регрессия 2026-08)', () => {
  const zeros = {
    contentTop: 0,
    deviceTop: 0,
    isFullscreen: false,
    contentReported: true,
  };

  it('iOS, sheet-режим со сплошной шапкой: честному нулю верим — без дыры 96px', () => {
    expect(computeSafeTop({ ...zeros, ios: true, overlaysContent: true })).toBe(
      0,
    );
  });

  it('Android, способный клиент с нулевой полосой — тоже без дыры', () => {
    expect(
      computeSafeTop({ ...zeros, ios: false, overlaysContent: true }),
    ).toBe(0);
  });

  it('клиент полосу прислать НЕ умеет — страховка под пилюлю «Закрыть»', () => {
    expect(
      computeSafeTop({
        contentTop: undefined,
        deviceTop: 0,
        isFullscreen: false,
        contentReported: false,
        ios: true,
        overlaysContent: true,
      }),
    ).toBe(96);
  });

  it('браузер на iOS: ноль — правда, чёлку закрывает CSS env()', () => {
    expect(
      computeSafeTop({ ...zeros, ios: true, overlaysContent: false }),
    ).toBe(0);
  });

  it('полный экран с нулевой полосой контента — тоже «не доехало», а не точное значение', () => {
    // device пришёл, content отчитан нулём: раньше вернули бы 47 и шапка
    // оказалась бы ровно под кнопками Telegram.
    expect(
      computeSafeTop({
        contentTop: 0,
        deviceTop: 47,
        isFullscreen: true,
        contentReported: true,
        ios: true,
        overlaysContent: true,
      }),
    ).toBe(123);
  });

  it('полный экран с обоими ненулевыми инсетами — по-прежнему точное значение', () => {
    expect(
      computeSafeTop({
        contentTop: 46,
        deviceTop: 47,
        isFullscreen: true,
        contentReported: true,
        ios: true,
        overlaysContent: true,
      }),
    ).toBe(93);
  });
});

// Регресс к скриншоту 2026-08: заголовок «Паттерны» стоял под пилюлей
// «Закрыть» на клиенте, который полосу контента прислать не умел — отступ
// обязан очищать не только статус-бар (~54pt), но и полосу кнопок (низ ~87pt).
describe('фолбэк очищает кнопки Telegram, а не только статус-бар', () => {
  const TELEGRAM_BUTTONS_BOTTOM_PT = 87;

  it('клиент без полосы контента на iOS в мессенджере → отступ ниже кнопок', () => {
    const top = computeSafeTop({
      contentTop: undefined,
      deviceTop: 0,
      isFullscreen: false,
      ios: true,
      contentReported: false,
      overlaysContent: true,
    });
    expect(top).toBeGreaterThan(TELEGRAM_BUTTONS_BOTTOM_PT);
  });

  it('в полноэкранном режиме без инсетов — тоже ниже кнопок', () => {
    const top = computeSafeTop({
      contentTop: 0,
      deviceTop: 0,
      isFullscreen: true,
      ios: true,
      contentReported: false,
      overlaysContent: true,
    });
    expect(top).toBeGreaterThan(TELEGRAM_BUTTONS_BOTTOM_PT);
  });

  it('браузер на iOS лишнего отступа не получает — там чёлку закрывает CSS', () => {
    expect(
      computeSafeTop({
        contentTop: 0,
        deviceTop: 0,
        isFullscreen: false,
        ios: true,
        contentReported: true,
        overlaysContent: false,
      }),
    ).toBe(0);
  });
});

// Развёрнутый (не полноэкранный) режим. Клиент, НЕ умеющий присылать полосу
// контента, получает страховку под кнопки; способный клиент с честным нулём
// (сплошная шапка над webview) — точное значение, включая device-инсет.
describe('развёрнутый режим: кнопки поверх контента, полосы контента нет', () => {
  const BUTTONS_BOTTOM_PT = 87;

  it('клиент без полосы контента, device есть → отступ ниже кнопок', () => {
    const top = computeSafeTop({
      contentTop: undefined,
      deviceTop: 59,
      isFullscreen: false,
      ios: true,
      contentReported: false,
      overlaysContent: true,
    });
    expect(top).toBeGreaterThan(BUTTONS_BOTTOM_PT);
  });

  it('способный клиент: полоса нулевая, device есть → ровно device, без страховки', () => {
    expect(
      computeSafeTop({
        contentTop: 0,
        deviceTop: 59,
        isFullscreen: false,
        ios: true,
        contentReported: true,
        overlaysContent: true,
      }),
    ).toBe(59);
  });

  it('клиент прислал НЕНУЛЕВУЮ полосу контента — верим ему точно', () => {
    expect(
      computeSafeTop({
        contentTop: 46,
        deviceTop: 59,
        isFullscreen: false,
        ios: true,
        contentReported: true,
        overlaysContent: true,
      }),
    ).toBe(105);
  });

  it('браузер лишнего отступа не получает', () => {
    expect(
      computeSafeTop({
        contentTop: 0,
        deviceTop: 0,
        isFullscreen: false,
        ios: true,
        contentReported: true,
        overlaysContent: false,
      }),
    ).toBe(0);
  });
});
