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
  opens30: 40,
  users30: 12,
  actions30: [
    { action: 'tracker', count: 15 },
    { action: 'breathing', count: 9 },
  ],
  hidden30: [{ action: 'plans', count: 2 }],
};

const EMPTY: PlusMetrics = {
  opens30: 0,
  users30: 0,
  actions30: [],
  hidden30: [],
};

describe('formatPlusMetrics', () => {
  it('пустая БД: ровно одна строка, без NaN и пустых списков', () => {
    const text = formatPlusMetrics(EMPTY);
    expect(text).toBe('➕ <b>Кнопка «плюс»</b>: за 30 дней ещё не открывали.');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('полные данные: открытия, топ действий человеческими именами, что прячут', () => {
    const text = formatPlusMetrics(FULL);
    expect(text).toContain('Открывали: 40 раз (12 человек)');
    expect(text).toContain(
      'Чаще всего выбирают: Трекер потребностей — 15 · Дыхание 4-4-6 — 9',
    );
    expect(text).toContain('Убирают из меню: Планы — 2');
    // Язык отчёта — без терминов и внутренних id (правило №8).
    expect(text).not.toMatch(/tracker|breathing|plans/);
  });

  it('нет выбора/скрытий — соответствующие строки не показываются пустыми', () => {
    const text = formatPlusMetrics({
      opens30: 3,
      users30: 2,
      actions30: [],
      hidden30: [],
    });
    expect(text).toContain('Открывали: 3 раз (2 человек)');
    expect(text).not.toContain('Чаще всего выбирают');
    expect(text).not.toContain('Убирают из меню');
  });

  it('неизвестный id не роняет отчёт — печатается как есть', () => {
    const text = formatPlusMetrics({
      opens30: 1,
      users30: 1,
      actions30: [{ action: 'новый_пункт', count: 1 }],
      hidden30: [],
    });
    expect(text).toContain('новый_пункт — 1');
  });

  it('у каждого id из реестра есть человеческая подпись', () => {
    for (const id of QUICK_ACTION_IDS) {
      expect(QUICK_ACTION_LABELS[id]).toBeTruthy();
    }
  });
});
