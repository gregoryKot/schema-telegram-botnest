// @vitest-environment jsdom
// Карточка дня потребностей (лист «Готово»): высота по содержимому, столбики цветом данных
// своей потребности, пропущенная потребность — пустой паз и «—», а не ноль.
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  needsDayCardHeight,
  drawNeedsDayCard,
  type NeedsDayRow,
} from './needsDayCard';
import { canvasWithMockCtx, printedText } from './canvas.test-helpers';
import { needDataInk, paperHex, DAY_DONE_HUE } from '../cardKit';

afterEach(() => vi.restoreAllMocks());

const ROWS: NeedsDayRow[] = [
  { id: 'attachment', label: 'Привязанность', value: 7, valueText: '7' },
  { id: 'autonomy', label: 'Автономия', value: null, valueText: '—' },
  { id: 'limits', label: 'Границы', value: 3, valueText: '3' },
];

const data = (rows = ROWS, subtitle?: string) => ({
  eyebrow: 'Трекер потребностей',
  title: 'Мой день',
  subtitle,
  rows,
  center: { value: '5,0', caption: 'индекс' },
  footerLabel: 'Трекер потребностей',
});

describe('needsDayCardHeight', () => {
  it('каждая строка и подпись добавляют высоту', () => {
    expect(needsDayCardHeight({ rows: [1, 2, 3, 4, 5] })).toBeGreaterThan(
      needsDayCardHeight({ rows: [1, 2] }),
    );
    expect(
      needsDayCardHeight({ rows: [1], subtitle: '25 июля' }),
    ).toBeGreaterThan(needsDayCardHeight({ rows: [1] }));
  });
});

describe('drawNeedsDayCard', () => {
  it('лист шалфея «Готово», индекс и подпись, числа и «—» у пропущенной', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    const fills: string[] = [];
    ctx.fill.mockImplementation(() => fills.push(ctx.fillStyle));
    drawNeedsDayCard(canvas, data(ROWS, '12 ноя'));
    const text = printedText(ctx);
    expect(text).toContain('Мой день');
    expect(text).toContain('5,0');
    expect(text).toContain('индекс');
    expect(text).toContain('Привязанность');
    expect(text).toContain('—');
    expect(fills).toContain(paperHex(DAY_DONE_HUE));
    // Столбики оценённых — цвет данных своей потребности; у пропущенной столбика нет.
    expect(fills).toContain(needDataInk('attachment'));
    expect(fills).toContain(needDataInk('limits'));
    expect(fills).not.toContain(needDataInk('autonomy'));
  });

  it('высота канваса совпадает с формулой', () => {
    const { canvas } = canvasWithMockCtx();
    drawNeedsDayCard(canvas, data());
    expect(canvas.height).toBe(needsDayCardHeight({ rows: ROWS }) * 3);
  });
});
