// QA 2026-11 (B-М8, B-М2): пустой экран «Планов» обещал несуществующую
// кнопку, а счётчик писал «1 активных · 1 завершённых».
import { describe, it, expect } from 'vitest';
import { plansEmptyText, plansSummary } from './plansCopy';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;

describe('plansEmptyText', () => {
  it('не обещает кнопку, которой нет, и зовёт выбрать потребность', () => {
    for (const tr of [ty, vy]) {
      expect(plansEmptyText(tr)).not.toContain('Запланировать практику');
      expect(plansEmptyText(tr)).toMatch(/позаботиться:$/);
    }
    expect(plansEmptyText(ty)).toContain('Выбери,');
    expect(plansEmptyText(vy)).toContain('Выберите,');
  });
});

describe('plansSummary', () => {
  it.each([
    [1, 1, '1 активный · 1 завершённый'],
    [2, 3, '2 активных · 3 завершённых'],
    [5, 0, '5 активных · 0 завершённых'],
    [21, 11, '21 активный · 11 завершённых'],
  ])('%i и %i → «%s»', (p, c, text) => {
    expect(plansSummary(p, c)).toBe(text);
  });
});
