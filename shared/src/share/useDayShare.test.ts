// @vitest-environment jsdom
// Хук карточки дня для DayShareButton: собирает готовые пропсы ShareCardSheet
// из оценок — обёртка над makeDayShare (уже покрыт cards/dayCard.test.ts),
// здесь проверяем только саму связку с датой по умолчанию.
import { describe, it, expect } from 'vitest';
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
  it('с явной датой — использует её в тексте шаринга', () => {
    const { result } = renderHook(() =>
      useDayShare(NEEDS, { attachment: 8 }, '2026-05-03', 'https://t.me/bot'),
    );
    expect(result.current.shareText).toContain('3 май');
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
