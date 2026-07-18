// Тест чистой логики карточки результата теста на схемы (шаринг).
import { describe, it, expect } from 'vitest';
import {
  ysqCardRows,
  buildYsqShareText,
  pluralActiveSchemas,
  YSQ_CARD_MAX_ROWS,
  type YsqCardSchema,
} from '../../../../shared/src/share/cards/ysqCard';

function schemas(n: number): YsqCardSchema[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `Схема ${i + 1}`,
    color: 'var(--accent-red)',
    pct5plus: 60,
    avg: 4.5,
  }));
}

describe('ysqCardRows', () => {
  it('обрезает до лимита и считает остаток', () => {
    const { rows, moreCount } = ysqCardRows(schemas(9));
    expect(rows).toHaveLength(YSQ_CARD_MAX_ROWS);
    expect(moreCount).toBe(9 - YSQ_CARD_MAX_ROWS);
  });

  it('меньше лимита — без остатка', () => {
    const { rows, moreCount } = ysqCardRows(schemas(2));
    expect(rows).toHaveLength(2);
    expect(moreCount).toBe(0);
  });
});

describe('buildYsqShareText', () => {
  it('содержит счёт выраженных схем и ссылку на бота', () => {
    const text = buildYsqShareText(3, 't.me/TestBot');
    expect(text).toContain('3 выраженные схемы из 20');
    expect(text).toContain('t.me/TestBot');
  });

  it('ноль схем — явная формулировка', () => {
    expect(buildYsqShareText(0, 't.me/TestBot')).toContain(
      'выраженных схем не обнаружено',
    );
  });
});

describe('pluralActiveSchemas', () => {
  it.each([
    [1, 'выраженная схема'],
    [2, 'выраженные схемы'],
    [4, 'выраженные схемы'],
    [5, 'выраженных схем'],
    [20, 'выраженных схем'],
  ])('%i → %s', (n, expected) => {
    expect(pluralActiveSchemas(n)).toBe(expected);
  });
});
