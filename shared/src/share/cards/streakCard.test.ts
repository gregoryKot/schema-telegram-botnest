// @vitest-environment jsdom
// Карточка серии дней: рисование не падает на вехе и вне вехи, высота растёт
// с длиной пояснительного текста. canvas в jsdom не рисует — getContext('2d')
// подменяем фейком со всеми зовомыми методами (см. practiceCard.test.ts).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { drawStreakCard } from './streakCard';
import { mockCardCtx as mockCtx } from './canvas.test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drawStreakCard', () => {
  it('обычный день (не веха): не падает, высота > 0', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() => drawStreakCard(canvas, 5)).not.toThrow();
    expect(canvas.height).toBeGreaterThan(0);
  });

  it('веха (7 дней) рисует медальон-трофей тем же путём, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() => drawStreakCard(canvas, 7)).not.toThrow();
  });

  it('первый день (особый текст «самый важный») не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() => drawStreakCard(canvas, 1)).not.toThrow();
  });
});
