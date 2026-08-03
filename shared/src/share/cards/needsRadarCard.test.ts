// @vitest-environment jsdom
// Тесты раскладки карточки-радара потребностей: высота считается по
// содержимому (без пустых хвостов и наездов на футер), а пропущенные
// потребности остаются «—», а не превращаются в нули. drawNeedsRadarCard —
// раскладка на подменённом 2d-контексте (jsdom не реализует canvas).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { needsRadarCardHeight, drawNeedsRadarCard } from './needsRadarCard';
import { dayIndex, dayRadarRows } from './dayCard';
import { drawWeeklyCard } from './weeklyCard';
import type { Need } from '../../types';

function mockCtx() {
  return {
    scale: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    shadowColor: '',
    shadowBlur: 0,
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn((s: string) => ({ width: s.length * 7 })),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left' as CanvasTextAlign,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('drawNeedsRadarCard', () => {
  it('с тайлами и подписью — не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawNeedsRadarCard(canvas, {
        eyebrow: 'Трекер потребностей',
        title: 'Мой день',
        subtitle: '3 мая',
        rows: dayRadarRows(NEEDS, { attachment: 7, limits: 0 }),
        center: { value: '7.0', caption: 'индекс' },
        tiles: [{ label: 'Серия дней', value: '5' }],
        footerLabel: 'Трекер потребностей',
      }),
    ).not.toThrow();
  });

  it('без тайлов и без подписи — компактнее, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const withExtra = document.createElement('canvas');
    drawNeedsRadarCard(withExtra, {
      eyebrow: 'Трекер',
      title: 'Мой день',
      subtitle: '3 мая',
      rows: dayRadarRows(NEEDS, { attachment: 7 }),
      center: { value: '7.0', caption: 'индекс' },
      tiles: [{ label: 'Серия', value: '5' }],
      footerLabel: 'Трекер',
    });
    const bare = document.createElement('canvas');
    drawNeedsRadarCard(bare, {
      eyebrow: 'Трекер',
      title: 'Мой день',
      rows: dayRadarRows(NEEDS, {}),
      center: { value: '—', caption: 'индекс' },
      footerLabel: 'Трекер',
    });
    expect(bare.height).toBeLessThan(withExtra.height);
  });
});

describe('drawWeeklyCard (обёртка над радаром — своя проверка серии)', () => {
  it('со стриком > 0 — добавляет плитку серии, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    const history = [
      { date: '2026-07-13', ratings: { attachment: 6, autonomy: 4 } },
      { date: '2026-07-14', ratings: { attachment: 8 } },
    ];
    expect(() => drawWeeklyCard(canvas, NEEDS, history, 5)).not.toThrow();
  });

  it('без серии (streak=0) — без лишней плитки, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() => drawWeeklyCard(canvas, NEEDS, [], 0)).not.toThrow();
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
