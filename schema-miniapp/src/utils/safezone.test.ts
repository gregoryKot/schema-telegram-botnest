// Регрессия: в полноэкранном режиме Telegram (fullscreen) кнопки шапки
// оказывались ПОД плавающими кнопками Telegram и не нажимались, когда клиент
// ещё не прислал contentSafeAreaInset. computeSafeTop обязан всегда очищать
// эту полосу. См. баг «кнопки некликабельны сверху» (июль 2026).
import { describe, it, expect } from 'vitest';
import { computeSafeTop } from './safezone';

const FULLSCREEN_CONTROLS_TOP = 48;

describe('computeSafeTop — не-полноэкранный режим', () => {
  it('складывает device + content, когда инсеты пришли', () => {
    expect(
      computeSafeTop({
        contentTop: 20,
        deviceTop: 47,
        isFullscreen: false,
        ios: true,
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
      }),
    ).toBe(0);
  });
});

describe('computeSafeTop — полноэкранный режим (регрессия кликабельности)', () => {
  it('инсеты не пришли: держим нижнюю границу device + полоса кнопок', () => {
    expect(
      computeSafeTop({
        contentTop: undefined,
        deviceTop: 47,
        isFullscreen: true,
        ios: true,
      }),
    ).toBe(47 + FULLSCREEN_CONTROLS_TOP);
  });

  it('contentTop явно 0 — всё равно очищаем полосу кнопок (не доверяем нулю)', () => {
    expect(
      computeSafeTop({
        contentTop: 0,
        deviceTop: 47,
        isFullscreen: true,
        ios: false,
      }),
    ).toBe(47 + FULLSCREEN_CONTROLS_TOP);
  });

  it('реальный contentTop больше границы — используем его (device + content)', () => {
    expect(
      computeSafeTop({
        contentTop: 60,
        deviceTop: 47,
        isFullscreen: true,
        ios: false,
      }),
    ).toBe(107);
  });

  it('совсем без инсетов — минимум = полоса кнопок, не ноль', () => {
    const v = computeSafeTop({
      contentTop: undefined,
      deviceTop: undefined,
      isFullscreen: true,
      ios: false,
    });
    expect(v).toBe(FULLSCREEN_CONTROLS_TOP);
    expect(v).toBeGreaterThan(0);
  });
});
