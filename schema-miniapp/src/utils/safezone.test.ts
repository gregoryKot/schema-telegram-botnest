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

  it('iOS без инсетов (contentTop не сообщён) — фолбэк 56', () => {
    expect(
      computeSafeTop({
        contentTop: undefined,
        deviceTop: undefined,
        isFullscreen: false,
        ios: true,
        contentReported: false,
      }),
    ).toBe(56);
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
