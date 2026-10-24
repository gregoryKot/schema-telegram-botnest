// Регресс Ж9 аудита 2026-08: webapp и miniapp показывали разный текст для
// одного и того же CTA/подсказки — теперь один источник для обоих.
import { describe, it, expect } from 'vitest';
import { BOOKING_CTA_LABEL, trackerTapHint } from './therapistCta';

describe('BOOKING_CTA_LABEL', () => {
  it('информативный вариант — со сводкой', () => {
    expect(BOOKING_CTA_LABEL).toBe('Записаться и взять сводку →');
  });
});

describe('trackerTapHint', () => {
  it('форма «ты»', () => {
    expect(trackerTapHint((ty) => ty)).toBe(
      'Нажми на потребность — узнаешь что делать',
    );
  });

  it('форма «вы»', () => {
    expect(trackerTapHint((_ty, vy) => vy)).toBe(
      'Нажмите на потребность — узнаете что делать',
    );
  });
});
