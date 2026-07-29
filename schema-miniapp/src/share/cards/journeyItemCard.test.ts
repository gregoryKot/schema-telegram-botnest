// Тест расчёта высоты карточки шага «Мой путь» (медальон + название +
// уточнение + дата) — чистая формула, зависит только от наличия уточнения.
import { describe, it, expect } from 'vitest';
import { journeyItemCardHeight } from '../../../../shared/src/share/cards/journeyItemCard';

describe('journeyItemCardHeight', () => {
  it('с уточнением выше, чем без него — на строку уточнения', () => {
    const withSub = journeyItemCardHeight(true);
    const withoutSub = journeyItemCardHeight(false);
    expect(withSub).toBeGreaterThan(withoutSub);
    expect(withSub - withoutSub).toBe(26);
  });
});
