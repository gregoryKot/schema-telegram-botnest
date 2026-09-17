// @vitest-environment jsdom
// Тест чистой логики карточки-профиля теста на схемы: короткие подписи,
// группировка по потребностям, отбор выраженных схем, формула высоты, и
// (в отличие от schema-miniapp/src/share/cards/ysqProfileCard.test.ts,
// который проверяет только чистые функции) раскладка на канвасе — прямой
// тест той же shared-функции, не перенос существующего теста (см. комментарий
// share/cardKit.test.ts). На карточку идут ТОЛЬКО выраженные схемы —
// невыраженная строка («—» или балл 1.5) ничего не сообщает тому, кому
// карточку отправили.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildYsqProfile,
  shortSchemaLabel,
  ysqProfileCardHeight,
  drawYsqProfileCard,
} from './ysqProfileCard';
import { SCHEMAS, DOMAIN_ORDER } from '../../hooks/ysqSchemas';
import { FOOTER_H } from '../cardKit';

function allScores(avg = 2, pct5plus = 0) {
  return Object.fromEntries(
    SCHEMAS.map((s) => [s.name, { avg, pct5plus }]),
  ) as Record<string, { pct5plus: number; avg: number }>;
}

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
    setLineDash: vi.fn(),
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

describe('shortSchemaLabel', () => {
  it('каждая схема получает короткую непустую подпись (влезает в колонку)', () => {
    for (const s of SCHEMAS) {
      const label = shortSchemaLabel(s.name);
      expect(label.length).toBeGreaterThan(0);
      expect(label.length).toBeLessThanOrEqual(21);
    }
  });

  it('обе пунитивности не схлопываются в одну', () => {
    expect(shortSchemaLabel('Пунитивность (на себя)')).not.toBe(
      shortSchemaLabel('Пунитивность (на других)'),
    );
  });
});

describe('buildYsqProfile', () => {
  it('все схемы выражены → все строки, домены в порядке DOMAIN_ORDER', () => {
    const domains = buildYsqProfile(allScores(5, 80));
    expect(domains.map((d) => d.needId)).toEqual(DOMAIN_ORDER);
    const rows = domains.reduce((n, d) => n + d.rows.length, 0);
    expect(rows).toBe(SCHEMAS.length);
  });

  it('невыраженные схемы в профиль не попадают, домен без выраженных не показывается', () => {
    const scores = allScores(2, 0);
    scores['Уязвимость'] = { avg: 4.3, pct5plus: 0 };
    const domains = buildYsqProfile(scores);
    expect(domains).toHaveLength(1);
    expect(domains[0].rows.map((r) => r.label)).toEqual(['Уязвимость']);
  });

  it('ни одной выраженной → пустой профиль (карточка покажет пустое состояние)', () => {
    expect(buildYsqProfile(allScores(2, 0))).toEqual([]);
  });
});

describe('ysqProfileCardHeight', () => {
  it('пустой профиль не ломает формулу и не уходит в ноль/NaN', () => {
    const h = ysqProfileCardHeight([]);
    expect(Number.isFinite(h)).toBe(true);
    expect(h).toBeGreaterThan(FOOTER_H);
  });

  it('заголовок в две строки добавляет высоту (регрессия — см. schema-miniapp тест)', () => {
    const domains = buildYsqProfile(allScores(5, 80));
    expect(ysqProfileCardHeight(domains, true, 2)).toBeGreaterThan(
      ysqProfileCardHeight(domains, true, 1),
    );
  });
});

describe('drawYsqProfileCard', () => {
  it('с выраженными схемами — рисует пороговую линию и бары, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    const domains = buildYsqProfile(allScores(5, 80));
    expect(() =>
      drawYsqProfileCard(canvas, domains, {
        headline: `${SCHEMAS.length} выраженных схем из ${SCHEMAS.length}`,
        dateLabel: '3 мая 2026',
      }),
    ).not.toThrow();
  });

  it('пустой профиль — «ни одна схема не выделилась», не падает', () => {
    const ctx = mockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const canvas = document.createElement('canvas');
    expect(() =>
      drawYsqProfileCard(canvas, [], {
        headline: 'Выраженных схем не обнаружено',
        dateLabel: null,
      }),
    ).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalledWith(
      'По ответам ни одна схема не выделилась',
      expect.any(Number),
      expect.any(Number),
    );
  });
});
