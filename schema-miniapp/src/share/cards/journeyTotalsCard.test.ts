// Тест расчётов карточки итогов «Мой путь»: строки + максимум для полосок
// прогресса + высота карточки. Чистая логика — без canvas.
import { describe, it, expect } from 'vitest';
import {
  totalsCardRows,
  journeyTotalsCardHeight,
} from '../../../../shared/src/share/cards/journeyTotalsCard';

const stat = (label: string, count: number) => ({ emoji: '·', label, count });

describe('totalsCardRows', () => {
  it('до 8 строк без хвоста, max — по показанным строкам', () => {
    const eight = Array.from({ length: 8 }, (_, i) => stat(`t${i}`, 8 - i));
    expect(totalsCardRows(eight)).toEqual({
      shown: eight,
      restCount: 0,
      max: 8,
    });
  });

  it('сверх 8 — хвост «и ещё N», max не учитывает хвост', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => stat(`t${i}`, 11 - i));
    const { shown, restCount, max } = totalsCardRows(eleven);
    expect(shown).toHaveLength(8);
    expect(restCount).toBe(3);
    expect(max).toBe(11); // первая (самая частая) строка входит в shown
  });

  it('пустой список → без строк, max=0 (не NaN)', () => {
    expect(totalsCardRows([])).toEqual({ shown: [], restCount: 0, max: 0 });
  });
});

describe('journeyTotalsCardHeight', () => {
  it('растёт с числом строк и хвостом', () => {
    const base = journeyTotalsCardHeight(0, false);
    const withRows = journeyTotalsCardHeight(3, false);
    const withRest = journeyTotalsCardHeight(3, true);
    expect(withRows).toBeGreaterThan(base);
    expect(withRest).toBeGreaterThan(withRows);
  });
});
