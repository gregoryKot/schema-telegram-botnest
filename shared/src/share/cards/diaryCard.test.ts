// @vitest-environment jsdom
// Сводная карточка дневника: earliestDateLabel — чистая функция (дата первой
// записи), drawDiaryCard — раскладка с датой и без. Правило «никаких
// заглушек»: без единой записи earliestDateLabel обязана вернуть null,
// а не сегодняшнюю дату (иначе на пустом дневнике покажется «веду с …»).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { earliestDateLabel, drawDiaryCard } from './diaryCard';

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

describe('earliestDateLabel', () => {
  it('пустой дневник — null, а не сегодняшняя дата (никаких заглушек)', () => {
    expect(earliestDateLabel([])).toBeNull();
  });

  it('несколько записей — берёт самую раннюю дату, а не первую по порядку массива', () => {
    const label = earliestDateLabel([
      { createdAt: '2026-05-10T10:00:00Z' },
      { createdAt: '2026-03-01T10:00:00Z' },
      { createdAt: '2026-04-15T10:00:00Z' },
    ]);
    expect(label).toBe(
      earliestDateLabel([{ createdAt: '2026-03-01T10:00:00Z' }]),
    );
  });

  it('битая дата — null, не мусор в интерфейсе', () => {
    expect(earliestDateLabel([{ createdAt: 'not-a-date' }])).toBeNull();
  });
});

describe('drawDiaryCard', () => {
  it('с датой первой записи — не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawDiaryCard(canvas, {
        emoji: '📓',
        title: 'Дневник схем',
        color: 'var(--accent)',
        count: 12,
        since: '3 мая',
      }),
    ).not.toThrow();
  });

  it('без записей (since=null) — компактнее, но не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const withDate = document.createElement('canvas');
    drawDiaryCard(withDate, {
      emoji: '📓',
      title: 'Дневник схем',
      color: 'var(--accent)',
      count: 1,
      since: '3 мая',
    });
    const noDate = document.createElement('canvas');
    drawDiaryCard(noDate, {
      emoji: '📓',
      title: 'Дневник схем',
      color: 'var(--accent)',
      count: 0,
      since: null,
    });
    expect(noDate.height).toBeLessThanOrEqual(withDate.height);
  });
});
