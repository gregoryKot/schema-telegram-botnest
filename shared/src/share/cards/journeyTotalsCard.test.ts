// Карточка итогов «Моего пути»: строки-хвост «и ещё N» и формула высоты
// карточки. Чистые части, без canvas.
import { describe, it, expect } from 'vitest';
import {
  totalsCardRows,
  journeyTotalsCardHeight,
  JOURNEY_TOTALS_MAX_ROWS,
} from './journeyTotalsCard';
import type { JourneyStatRow } from '../../journey/journeyStats';

const stat = (label: string, count: number): JourneyStatRow => ({
  emoji: '·',
  label,
  count,
});

describe('totalsCardRows', () => {
  it('ровно 8 строк — все показаны, хвоста нет', () => {
    const rows = Array.from({ length: 8 }, (_, i) => stat(`t${i}`, 8 - i));
    const { shown, restCount, max } = totalsCardRows(rows);
    expect(shown).toEqual(rows);
    expect(restCount).toBe(0);
    expect(max).toBe(8);
  });

  it('больше 8 — обрезка по JOURNEY_TOTALS_MAX_ROWS, остальное в хвост', () => {
    const rows = Array.from({ length: 11 }, (_, i) => stat(`t${i}`, 11 - i));
    const { shown, restCount } = totalsCardRows(rows);
    expect(shown).toHaveLength(JOURNEY_TOTALS_MAX_ROWS);
    expect(restCount).toBe(3);
  });

  it('пустая сводка — пусто, max=0 (пустой аккаунт без мусора)', () => {
    expect(totalsCardRows([])).toEqual({ shown: [], restCount: 0, max: 0 });
  });
});

describe('journeyTotalsCardHeight', () => {
  it('пустая сводка — компактнее (одна поясняющая строка вместо списка)', () => {
    const empty = journeyTotalsCardHeight(0, false);
    const withRows = journeyTotalsCardHeight(3, false);
    expect(empty).toBeLessThan(withRows);
  });

  it('наличие хвоста «и ещё N» увеличивает высоту', () => {
    expect(journeyTotalsCardHeight(3, true)).toBeGreaterThan(
      journeyTotalsCardHeight(3, false),
    );
  });

  it('высота растёт монотонно с числом показанных строк', () => {
    expect(journeyTotalsCardHeight(5, false)).toBeGreaterThan(
      journeyTotalsCardHeight(2, false),
    );
  });
});
