// Тесты раскладки карточки-радара потребностей: высота считается по
// содержимому (без пустых хвостов и наездов на футер), а пропущенные
// потребности остаются «—», а не превращаются в нули.
import { describe, it, expect } from 'vitest';
import { needsRadarCardHeight } from './needsRadarCard';
import { dayIndex, dayRadarRows } from './dayCard';
import type { Need } from '../../types';

const NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: 'Привязанность',
    chartLabel: 'Привязанность',
  },
  { id: 'autonomy', emoji: '🧭', title: 'Автономия', chartLabel: 'Автономия' },
  { id: 'limits', emoji: '⚖️', title: 'Границы', chartLabel: 'Границы' },
];

describe('needsRadarCardHeight', () => {
  it('каждая строка списка добавляет высоту', () => {
    const two = needsRadarCardHeight({ rows: [1, 2] });
    const five = needsRadarCardHeight({ rows: [1, 2, 3, 4, 5] });
    expect(five).toBeGreaterThan(two);
  });

  it('подпись и плитки увеличивают карточку', () => {
    const plain = needsRadarCardHeight({ rows: [1, 2, 3] });
    expect(
      needsRadarCardHeight({ rows: [1, 2, 3], subtitle: '25 июля' }),
    ).toBeGreaterThan(plain);
    expect(
      needsRadarCardHeight({ rows: [1, 2, 3], tiles: [1] }),
    ).toBeGreaterThan(plain);
  });

  it('карточка выше радара с шапкой и футером', () => {
    expect(needsRadarCardHeight({ rows: [1, 2, 3, 4, 5] })).toBeGreaterThan(
      400,
    );
  });
});

describe('dayRadarRows', () => {
  it('отмеченные потребности отдают число, пропущенные — «—» и null', () => {
    const rows = dayRadarRows(NEEDS, { attachment: 7, limits: 0 });
    expect(rows.map((r) => r.valueText)).toEqual(['7', '—', '0']);
    expect(rows.map((r) => r.value)).toEqual([7, null, 0]);
  });

  it('порядок и подписи повторяют список потребностей', () => {
    const rows = dayRadarRows(NEEDS, {});
    expect(rows.map((r) => r.label)).toEqual([
      'Привязанность',
      'Автономия',
      'Границы',
    ]);
    expect(rows.every((r) => r.value === null)).toBe(true);
  });

  it('у каждой строки свой цвет потребности', () => {
    const colors = dayRadarRows(NEEDS, {}).map((r) => r.color);
    expect(new Set(colors).size).toBe(NEEDS.length);
  });
});

describe('dayIndex', () => {
  it('среднее только по отмеченным потребностям', () => {
    expect(dayIndex(NEEDS, { attachment: 8, autonomy: 6 })).toBe(7);
  });

  it('без оценок индекса нет (в карточке будет «—»)', () => {
    expect(dayIndex(NEEDS, {})).toBeNull();
  });
});
