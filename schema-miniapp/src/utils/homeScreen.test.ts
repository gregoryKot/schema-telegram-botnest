// Шаг «добавить на экран» показываем только там, где нативный экран Telegram
// корректен. На iOS он показывает инструкцию «нажми три точки», а открывает
// «Поделиться» — такой шаг вводит в заблуждение, поэтому его там нет.
import { describe, it, expect } from 'vitest';
import { canOfferHomeScreen } from './homeScreen';

describe('canOfferHomeScreen', () => {
  it('Android — предлагаем', () => {
    expect(canOfferHomeScreen('android', true)).toBe(true);
    expect(canOfferHomeScreen('android_x', true)).toBe(true);
  });

  it('iOS — не предлагаем даже при доступном API', () => {
    expect(canOfferHomeScreen('ios', true)).toBe(false);
  });

  it('десктоп и веб-клиенты — не предлагаем', () => {
    for (const p of ['macos', 'tdesktop', 'weba', 'webk', 'unknown']) {
      expect(canOfferHomeScreen(p, true)).toBe(false);
    }
  });

  it('нет API (старый клиент) — не предлагаем', () => {
    expect(canOfferHomeScreen('android', false)).toBe(false);
  });

  it('платформа неизвестна — не предлагаем', () => {
    expect(canOfferHomeScreen(undefined, true)).toBe(false);
  });
});
