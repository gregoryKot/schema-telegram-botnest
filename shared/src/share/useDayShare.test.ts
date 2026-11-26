// @vitest-environment jsdom
// Хук карточки дня для DayShareButton: собирает готовые пропсы ShareCardSheet
// из оценок — обёртка над makeDayShare (уже покрыт cards/dayCard.test.ts),
// здесь проверяем только саму связку с датой по умолчанию.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDayShare } from './useDayShare';
import type { Need } from '../types';

const NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: 'Привязанность',
    chartLabel: 'Привяз.',
  },
];

describe('useDayShare', () => {
  afterEach(() => vi.useRealTimers());

  // «3 мая», не «3 май» (QA 2026-10-26). Часы — 2026: дата другого года
  // показывается с годом.
  it('с явной датой — использует её в тексте шаринга', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    const { result } = renderHook(() =>
      useDayShare(NEEDS, { attachment: 8 }, '2026-05-03', 'https://t.me/bot'),
    );
    expect(result.current.shareText).toContain('3 мая');
    expect(result.current.shareText).not.toContain('2026');
    expect(result.current.filename).toBe('needs-day.png');
  });

  it('без даты — подставляет сегодняшнюю (todayStr), не падает', () => {
    const { result } = renderHook(() =>
      useDayShare(NEEDS, {}, undefined, 'https://t.me/bot'),
    );
    expect(typeof result.current.shareText).toBe('string');
    expect(result.current.shareText).toContain('—/10');
  });
});
