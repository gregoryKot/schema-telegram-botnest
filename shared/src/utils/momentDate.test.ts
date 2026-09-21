// Зеркальный класс к инциденту 2026-09-17: там календарный день читали
// локальной полночью, здесь МОМЕНТ резали строкой и показывали гринвичским —
// день записи и время на экране уезжали на смещение зоны.
//
// Тест обязан краснеть В ЛЮБОЙ ЧАС прогона, иначе он неделями зелёный на main
// и класс живёт дальше. Поэтому «сейчас» задаётся фейковыми таймерами
// (`toFake: ['Date']` — только Date, иначе waitFor у testing-library виснет),
// моменты выбраны там, где гринвичский день и локальный заведомо разные, а
// зоны обходятся изнутри теста: расхождение видно на любой машине, а не
// только во второй CI-джобе.
import { describe, it, expect, vi } from 'vitest';
import {
  momentDayKey,
  momentIsToday,
  momentDayLabel,
  momentTime,
} from './momentDate';
import { todayCalendarDate } from './calendarDate';
import { fmtDate, todayStr } from './format';
import { forEachTimeZone } from './timeZone.test-helpers';

// 23:30Z — в Australia/Sydney уже следующие сутки; 00:30Z — в
// America/Los_Angeles ещё предыдущие. Оба конца расхождения покрыты.
const LATE_UTC = '2026-09-18T23:30:00.000Z';
const EARLY_UTC = '2026-09-19T00:30:00.000Z';

/** Выполняет fn в каждой зоне с часами, замороженными на iso. */
function frozenAt(iso: string, fn: (tz: string) => void): void {
  forEachTimeZone((tz) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
    try {
      fn(tz);
    } finally {
      vi.useRealTimers();
    }
  });
}

/** Как это было до починки: срез строки против локального «сегодня». */
const slicedLabel = (iso: string): string =>
  iso.slice(0, 10) === todayStr() ? 'Сегодня' : fmtDate(iso.slice(0, 10));

describe('momentDayLabel — день момента', () => {
  for (const iso of [LATE_UTC, EARLY_UTC]) {
    it(`запись, сделанная только что (${iso}), подписана «Сегодня» в любой зоне`, () => {
      frozenAt(iso, (tz) => {
        expect(momentDayLabel(iso), tz).toBe('Сегодня');
      });
    });

    // Контроль (правило №15): без него предыдущая проверка могла бы зеленеть
    // и со старой реализацией — то есть не доказывать ничего.
    it(`контроль: прежний срез на ${iso} в какой-то зоне даёт НЕ «Сегодня»`, () => {
      const seen = new Set<string>();
      frozenAt(iso, () => {
        seen.add(slicedLabel(iso));
      });
      expect([...seen].some((label) => label !== 'Сегодня')).toBe(true);
    });
  }

  it('вчерашний момент подписан датой, а не «Сегодня»', () => {
    frozenAt(LATE_UTC, (tz) => {
      const yesterday = new Date(Date.parse(LATE_UTC) - 86400000).toISOString();
      expect(momentDayLabel(yesterday), tz).not.toBe('Сегодня');
      expect(momentDayLabel(yesterday), tz).toBe(
        fmtDate(momentDayKey(yesterday)),
      );
    });
  });

  it('нечитаемая строка — пустая подпись, не «Invalid Date»', () => {
    forEachTimeZone((tz) => {
      expect(momentDayLabel('мусор'), tz).toBe('');
      expect(momentDayKey('мусор'), tz).toBe('');
      expect(momentIsToday('мусор'), tz).toBe(false);
    });
  });
});

describe('momentDayKey — система координат под вид строки', () => {
  it('момент отдаётся днём зоны читателя', () => {
    forEachTimeZone((tz) => {
      const d = new Date(LATE_UTC);
      const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      expect(momentDayKey(LATE_UTC), tz).toBe(expected);
    });
  });

  it('контроль: этот день в разных зонах правда разный', () => {
    const seen = new Set<string>();
    forEachTimeZone(() => {
      seen.add(momentDayKey(LATE_UTC));
    });
    expect(seen.size).toBeGreaterThan(1);
  });

  it('календарный день остаётся собой — зона его не двигает', () => {
    forEachTimeZone((tz) => {
      expect(momentDayKey('2026-07-21'), tz).toBe('2026-07-21');
    });
  });
});

describe('momentIsToday — обе стороны в одних координатах', () => {
  it('момент «сейчас» — сегодня в любой зоне', () => {
    for (const iso of [LATE_UTC, EARLY_UTC]) {
      frozenAt(iso, (tz) => {
        expect(momentIsToday(iso), tz).toBe(true);
      });
    }
  });

  it('календарный день сервера сверяется с календарным «сегодня»', () => {
    frozenAt(LATE_UTC, (tz) => {
      expect(momentIsToday(todayCalendarDate()), tz).toBe(true);
      expect(momentIsToday('2026-07-21'), tz).toBe(false);
    });
  });
});

describe('momentTime — время в зоне читателя', () => {
  it('совпадает с локальным временем момента в любой зоне', () => {
    forEachTimeZone((tz) => {
      const d = new Date(LATE_UTC);
      const expected = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      expect(momentTime(LATE_UTC), tz).toBe(expected);
    });
  });

  // Контроль: прежний `iso.slice(11, 16)` один и тот же во всех зонах —
  // он показывал Гринвич. Если бы локальное время тоже не менялось, проверка
  // выше ничего бы не доказывала.
  it('контроль: гринвичский срез одинаков везде, локальное время — нет', () => {
    const sliced = new Set<string>();
    const local = new Set<string>();
    forEachTimeZone(() => {
      sliced.add(LATE_UTC.slice(11, 16));
      local.add(momentTime(LATE_UTC));
    });
    expect(sliced.size).toBe(1);
    expect(local.size).toBeGreaterThan(1);
  });

  it('у календарного дня времени нет — пустая строка', () => {
    forEachTimeZone((tz) => {
      expect(momentTime('2026-07-21'), tz).toBe('');
      expect(momentTime('мусор'), tz).toBe('');
    });
  });
});
