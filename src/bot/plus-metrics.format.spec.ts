// Форматтер блока «Кнопка «плюс»» в /stats: полные данные, пустая БД (без
// NaN и голых ключей), подписи пунктов без словаря и сверка с реестром
// QUICK_ACTION_IDS — новый пункт без подписи вылез бы в отчёт как id.
import {
  formatPlusMetrics,
  QUICK_ACTION_LABELS,
  PlusMetrics,
} from './plus-metrics.format';
import { QUICK_ACTION_IDS } from '../analytics/analytics.constants';

const FULL: PlusMetrics = {
  hidden30: [
    { action: 'plans', count: 2 },
    { action: 'tracker', count: 1 },
  ],
  moves30: 6,
};

const EMPTY: PlusMetrics = { hidden30: [], moves30: 0 };

describe('formatPlusMetrics', () => {
  it('пустая БД: ровно одна строка, без NaN и пустых списков', () => {
    const text = formatPlusMetrics(EMPTY);
    expect(text).toBe(
      '➕ <b>Кнопка «плюс»</b>: за 30 дней меню не настраивали.',
    );
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('полные данные: что прячут человеческими именами, перестановки', () => {
    const text = formatPlusMetrics(FULL);
    expect(text).toContain(
      'Убирают из меню: Планы — 2 · Трекер потребностей — 1',
    );
    expect(text).toContain('Меняли порядок пунктов: 6 раз');
    // Язык отчёта — без терминов и внутренних id (правило №8).
    expect(text).not.toMatch(/tracker|plans/);
  });

  it('нет скрытий — строка не показывается пустой', () => {
    const text = formatPlusMetrics({ hidden30: [], moves30: 4 });
    expect(text).toContain('Меняли порядок пунктов: 4 раз');
    expect(text).not.toContain('Убирают из меню');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('нет перестановок — строка не показывается', () => {
    const text = formatPlusMetrics({
      hidden30: [{ action: 'plans', count: 1 }],
      moves30: 0,
    });
    expect(text).not.toContain('Меняли порядок пунктов');
  });

  it('неизвестный id не роняет отчёт — печатается как есть', () => {
    const text = formatPlusMetrics({
      hidden30: [{ action: 'новый_пункт', count: 1 }],
      moves30: 0,
    });
    expect(text).toContain('новый_пункт — 1');
  });

  it('у каждого id из реестра есть человеческая подпись', () => {
    for (const id of QUICK_ACTION_IDS) {
      expect(QUICK_ACTION_LABELS[id]).toBeTruthy();
    }
  });
});
