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
  fmtAgo,
  momentDayKey,
  momentIsToday,
  momentDayLabel,
  momentTime,
} from './momentDate';
import { fmtDate, todayStr } from './format';
import { forEachTimeZone, withTimeZone } from './timeZone.test-helpers';

// 23:30Z — в Australia/Sydney уже следующие сутки; 00:30Z — в
// America/Los_Angeles ещё предыдущие. Оба конца расхождения покрыты.
const LATE_UTC = '2026-09-18T23:30:00.000Z';
const EARLY_UTC = '2026-09-19T00:30:00.000Z';

/** Выполняет fn в каждой зоне с часами, замороженными на at: ISO-момент или
 *  местное время, собранное уже в зоне прогона (`() => new Date(y, m, d, h)`). */
function frozenAt(at: string | (() => Date), fn: (tz: string) => void): void {
  forEachTimeZone((tz) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(typeof at === 'string' ? new Date(at) : at());
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

  // QA 2026-10-26: день оценки или записи дневника — местный день самого
  // человека; сверка с днём UTC в 00:10 по Москве делала сегодняшнюю запись
  // вчерашней, а вчерашнюю — «Сегодня».
  it('календарный день сверяется с местным «сегодня» читателя', () => {
    frozenAt(LATE_UTC, (tz) => {
      expect(momentIsToday(todayStr()), tz).toBe(true);
      expect(momentIsToday('2026-07-21'), tz).toBe(false);
    });
  });

  it('00:10 по Москве (21:10 UTC): 27-е — сегодня, 26-е — нет', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T21:10:00Z'));
    try {
      withTimeZone('Europe/Moscow', () => {
        expect(momentIsToday('2026-10-27')).toBe(true);
        expect(momentIsToday('2026-10-26')).toBe(false);
        expect(momentDayLabel('2026-10-27')).toBe('Сегодня');
        expect(momentDayLabel('2026-10-26')).toBe('26 окт');
      });
      withTimeZone('America/Los_Angeles', () => {
        expect(momentIsToday('2026-10-26')).toBe(true);
        expect(momentIsToday('2026-10-27')).toBe(false);
      });
    } finally {
      vi.useRealTimers();
    }
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

// Давность — календарными днями читателя, а не сутками по 24 ч от «сейчас»: запись
// вчера в 22:00, открытая в 08:00, была подписана «сегодня». Часы и момент — местное
// время зоны прогона (aug), поэтому граница суток проверяется в каждой зоне.
describe('fmtAgo — давность по календарю читателя', () => {
  const aug = (day: number, hour: number, min = 0) =>
    new Date(2026, 7, day, hour, min);
  const ago = (d: Date) => fmtAgo(d.toISOString());
  /** fn в каждой зоне с часами на aug(day, hour). */
  const at = (day: number, hour: number, fn: (tz: string) => void) =>
    frozenAt(() => aug(day, hour), fn);

  it('вечер вчера → утро сегодня — «вчера», хотя прошло 10 ч', () => {
    at(4, 8, (tz) => {
      expect(ago(aug(3, 22)), tz).toBe('вчера');
      // контроль: меньше суток — сутками по 24 ч это было «сегодня»
      expect(Date.now() - aug(3, 22).getTime()).toBe(10 * 3600000);
    });
  });

  it('тот же местный день — «сегодня», и момент чуть впереди часов тоже', () => {
    at(3, 23, (tz) => {
      expect(ago(aug(3, 0, 1)), tz).toBe('сегодня');
      // часы устройства отстают от сервера на минуту: сутками было «-1 дн. назад»
      expect(ago(aug(3, 23, 1)), tz).toBe('сегодня');
    });
  });

  it('со второго дня — «N дн. назад», с седьмого — дата', () => {
    at(5, 9, (tz) => {
      // 33,5 ч назад, но позавчера: сутками было «вчера»
      expect(ago(aug(3, 23, 30)), tz).toBe('2 дн. назад');
    });
    at(20, 12, (tz) => {
      expect(ago(aug(14, 12)), tz).toBe('6 дн. назад');
      expect(ago(aug(13, 12)), tz).toBe('13 авг');
    });
  });

  // Пин на случай «починки» вывода на UTC: 23:00 UTC в Сиднее — уже следующий день.
  it('давний момент у полуночи UTC — днём зоны читателя', () => {
    const shown: Record<string, string> = {};
    frozenAt('2026-08-20T12:00:00Z', (tz) => {
      shown[tz] = fmtAgo('2026-08-03T23:00:00Z');
    });
    expect(shown['Australia/Sydney']).toBe('4 авг');
    expect(shown['America/Los_Angeles']).toBe('3 авг');
  });

  it('календарный день — как есть, нечитаемая строка — пустая', () => {
    at(4, 0, (tz) => {
      expect(fmtAgo('2026-08-04'), tz).toBe('сегодня');
      expect(fmtAgo('2026-08-03'), tz).toBe('вчера');
      expect(fmtAgo('мусор'), tz).toBe('');
    });
  });
});
