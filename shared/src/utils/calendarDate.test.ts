// Регрессия инцидента 2026-09-17 (TZ-зависимый разбор дат): календарный день
// `YYYY-MM-DD` читался как полночь зоны машины, поэтому фильтр «Моего пути»
// давал разный ответ на UTC и на UTC+3, а CI (всегда UTC) молчал. Проверки
// ниже сами обходят зоны — так расхождение видно на любой машине, а не только
// под второй CI-джобой.
import { describe, it, expect } from 'vitest';
import {
  isCalendarDate,
  dateStringMs,
  dateStringParts,
  formatDateString,
} from './calendarDate';
import { withTimeZone, forEachTimeZone } from './timeZone.test-helpers';

describe('forEachTimeZone', () => {
  it('возвращает зону процесса обратно — иначе соседние тесты поедут', () => {
    const before = new Date('2026-07-14T00:00:00').getTime();
    forEachTimeZone(() => undefined);
    expect(new Date('2026-07-14T00:00:00').getTime()).toBe(before);
  });

  it('зона внутри правда меняется (иначе прогон ничего не проверяет)', () => {
    const seen = new Set<number>();
    forEachTimeZone(() => {
      seen.add(new Date('2026-07-14T00:00:00').getTime());
    });
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('isCalendarDate', () => {
  it('день без времени — да; момент, обрезки и мусор — нет', () => {
    expect(isCalendarDate('2026-07-14')).toBe(true);
    expect(isCalendarDate('2026-07-14T10:00:00.000Z')).toBe(false);
    expect(isCalendarDate('2026-7-4')).toBe(false);
    expect(isCalendarDate('2026-07')).toBe(false);
    expect(isCalendarDate('мусор')).toBe(false);
  });
});

describe('dateStringMs', () => {
  it('календарный день — полночь UTC в любой зоне машины', () => {
    const utcMidnight = Date.UTC(2026, 6, 14);
    forEachTimeZone((tz) => {
      expect(dateStringMs('2026-07-14'), tz).toBe(utcMidnight);
    });
  });

  it('момент времени — один и тот же в любой зоне машины', () => {
    forEachTimeZone((tz) => {
      expect(dateStringMs('2026-07-14T10:30:00.000Z'), tz).toBe(
        Date.UTC(2026, 6, 14, 10, 30),
      );
    });
  });

  it('нечитаемая строка — NaN (вызывающий отбрасывает запись, а не падает)', () => {
    forEachTimeZone((tz) => {
      expect(Number.isNaN(dateStringMs('мусор')), tz).toBe(true);
      expect(Number.isNaN(dateStringMs('2026-13-45')), tz).toBe(true);
    });
  });
});

describe('dateStringParts', () => {
  it('день остаётся собой в любой зоне — включая западные смещения', () => {
    // На UTC-7 разбор «по-местному» давал 13 июля: ровно этот сдвиг и был
    // корнем инцидента.
    forEachTimeZone((tz) => {
      expect(dateStringParts('2026-07-14'), tz).toEqual({
        year: 2026,
        month: 7,
        day: 14,
        weekday: 2, // вторник
      });
    });
  });

  it('у момента времени части — в зоне читателя (её он и имеет в виду)', () => {
    // 20:00 UTC — это уже следующее утро в Сиднее и тот же вечер в Иерусалиме.
    expect(
      withTimeZone('Australia/Sydney', () =>
        dateStringParts('2026-07-14T20:00:00.000Z'),
      )?.day,
    ).toBe(15);
    expect(
      withTimeZone('Asia/Jerusalem', () =>
        dateStringParts('2026-07-14T20:00:00.000Z'),
      )?.day,
    ).toBe(14);
  });

  it('нечитаемая строка — null', () => {
    expect(dateStringParts('мусор')).toBeNull();
  });
});

describe('formatDateString', () => {
  it('день показывается своим числом в любой зоне', () => {
    forEachTimeZone((tz) => {
      expect(
        formatDateString('2026-07-14', { day: 'numeric', month: 'long' }),
        tz,
      ).toBe('14 июля');
    });
  });

  it('момент времени показывается в зоне читателя', () => {
    const at = '2026-07-14T20:00:00.000Z';
    const options = { day: 'numeric', month: 'long' } as const;
    expect(
      withTimeZone('Australia/Sydney', () => formatDateString(at, options)),
    ).toBe('15 июля');
    expect(
      withTimeZone('America/Los_Angeles', () => formatDateString(at, options)),
    ).toBe('14 июля');
  });

  it('нечитаемая строка — пусто, а не «Invalid Date»', () => {
    expect(formatDateString('мусор', { day: 'numeric' })).toBe('');
  });
});
