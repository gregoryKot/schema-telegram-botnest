// QA 2026-11 (B-М8, B-М2): пустой экран «Планов» обещал несуществующую
// кнопку, а счётчик писал «1 активных · 1 завершённых».
import { describe, it, expect } from 'vitest';
import { planDateLabel, plansEmptyText, plansSummary } from './plansCopy';
import { forEachTimeZone } from '../utils/timeZone.test-helpers';

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

// docs/open/frontend-ux.md: «Сегодня/Завтра» считались через toISOString()
// (день UTC), прочие даты — new Date('YYYY-MM-DD') в местной зоне.
describe('planDateLabel — местный день человека в любой зоне', () => {
  it('сразу после местной полуночи: сегодня — местный день, а не день UTC', () => {
    forEachTimeZone((tz) => {
      const now = new Date(2026, 10, 6, 0, 30); // 6 ноября, 00:30 по зоне
      expect(planDateLabel('2026-11-06', now), tz).toBe('Сегодня');
      expect(planDateLabel('2026-11-07', now), tz).toBe('Завтра');
      expect(planDateLabel('2026-11-05', now), tz).toBe('5 нояб.');
    });
  });

  it('поздно вечером: завтра по UTC ещё не «Сегодня»', () => {
    forEachTimeZone((tz) => {
      const now = new Date(2026, 10, 6, 23, 30);
      expect(planDateLabel('2026-11-06', now), tz).toBe('Сегодня');
      expect(planDateLabel('2026-11-07', now), tz).toBe('Завтра');
    });
  });

  it('прочий день показывается своим числом, без сдвига на соседнее', () => {
    forEachTimeZone((tz) => {
      const now = new Date(2026, 10, 20, 12, 0);
      expect(planDateLabel('2026-11-01', now), tz).toBe('1 нояб.');
      expect(planDateLabel('2026-12-31', now), tz).toBe('31 дек.');
    });
  });

  it('конец месяца и года: «Завтра» переходит через границу', () => {
    forEachTimeZone((tz) => {
      expect(
        planDateLabel('2027-01-01', new Date(2026, 11, 31, 22, 0)),
        tz,
      ).toBe('Завтра');
    });
  });
});
