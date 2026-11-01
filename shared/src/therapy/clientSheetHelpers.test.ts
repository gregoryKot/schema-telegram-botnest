// Хелперы карточки клиента жили копией в webapp и мини-аппе (правило №3),
// сведены в shared. Тест держит склеенную логику: русская плюрализация
// длительности и формат «день недели, число месяц · время».
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  isVirtualClient,
  isActiveToday,
  calcTherapyDuration,
  nextSessionLabel,
  indexColor,
  CONCEPT_FIELDS,
} from './clientSheetHelpers';
import { forEachTimeZone, withTimeZone } from '../utils/timeZone.test-helpers';

describe('calcTherapyDuration', () => {
  afterEach(() => vi.useRealTimers());

  const withNow = (iso: string, fn: () => void) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    fn();
  };

  it('меньше суток — «сегодня»', () => {
    withNow('2026-01-10T12:00:00', () =>
      expect(calcTherapyDuration('2026-01-10T09:00:00')).toBe('сегодня'),
    );
  });

  // Полные локальные datetime-строки: и «сейчас», и старт разбираются в одном
  // часовом поясе, поэтому разница дней точна и в UTC-CI, и в любом TZ.
  it('дни склоняются (1 день / 2 дня / 5 дней / 11 дней)', () => {
    withNow('2026-01-12T00:00:00', () =>
      expect(calcTherapyDuration('2026-01-11T00:00:00')).toBe('1 день'),
    );
    withNow('2026-01-14T00:00:00', () =>
      expect(calcTherapyDuration('2026-01-12T00:00:00')).toBe('2 дня'),
    );
    withNow('2026-01-17T00:00:00', () =>
      expect(calcTherapyDuration('2026-01-12T00:00:00')).toBe('5 дней'),
    );
    withNow('2026-01-23T00:00:00', () =>
      expect(calcTherapyDuration('2026-01-12T00:00:00')).toBe('11 дней'),
    );
  });

  // Регрессия инцидента 2026-09-17: старт приходит календарным днём, а
  // разбирался в зоне машины — на UTC-7 «2026-03-01» становился 28 февраля,
  // и месяц старта съезжал: «1 месяц в терапии» показывался как «2 месяца».
  it('длительность не зависит от зоны машины', () => {
    forEachTimeZone((tz) => {
      withNow('2026-04-01T12:00:00', () => {
        expect(calcTherapyDuration('2026-03-01'), tz).toBe('1 месяц');
        expect(calcTherapyDuration('2026-04-01'), tz).toBe('сегодня');
      });
    });
  });

  it('нечитаемая дата — пусто, а не «NaN месяцев»', () => {
    expect(calcTherapyDuration('мусор')).toBe('');
  });

  // QA 2026-10-26: месяц считался по календарным месяцам — начало 30 сен
  // давало «1 месяц» уже 26 окт (26 дней), а 1 окт — «25 дней». Месяц
  // засчитывается, когда прошёл целиком: число дошло до числа начала.
  it('месяц — только полный: граница по числу месяца', () => {
    const T = '2026-10-26';
    expect(calcTherapyDuration('2026-09-30', T)).toBe('26 дней');
    expect(calcTherapyDuration('2026-10-01', T)).toBe('25 дней');
    expect(calcTherapyDuration('2026-09-27', T)).toBe('29 дней');
    expect(calcTherapyDuration('2026-09-26', T)).toBe('1 месяц');
    expect(calcTherapyDuration('2026-09-25', T)).toBe('1 месяц');
    expect(calcTherapyDuration('2026-07-27', T)).toBe('2 месяца');
    expect(calcTherapyDuration('2026-07-26', T)).toBe('3 месяца');
    expect(calcTherapyDuration('2025-10-26', T)).toBe('12 месяцев');
    expect(calcTherapyDuration('2025-10-27', T)).toBe('11 месяцев');
  });

  it('31-е в коротком месяце — его последний день', () => {
    expect(calcTherapyDuration('2026-01-31', '2026-02-27')).toBe('27 дней');
    expect(calcTherapyDuration('2026-01-31', '2026-02-28')).toBe('1 месяц');
    expect(calcTherapyDuration('2028-01-31', '2028-02-28')).toBe('28 дней');
    expect(calcTherapyDuration('2028-01-31', '2028-02-29')).toBe('1 месяц');
    expect(calcTherapyDuration('2026-08-31', '2026-09-30')).toBe('1 месяц');
  });

  // QA 2026-10-26: будущее начало давало «в работе сегодня».
  it('начало в будущем — пусто, срока ещё нет', () => {
    expect(calcTherapyDuration('2026-10-27', '2026-10-26')).toBe('');
    expect(calcTherapyDuration('2026-11-26', '2026-10-26')).toBe('');
    expect(calcTherapyDuration('2026-10-26', '2026-10-26')).toBe('сегодня');
  });

  // Дату начала терапевт вводит по своим часам — «сегодня» местное.
  it('по умолчанию сегодня — местный день: 00:10 по Москве уже 27-е', () => {
    withNow('2026-10-26T21:10:00Z', () => {
      withTimeZone('Europe/Moscow', () => {
        expect(calcTherapyDuration('2026-10-27')).toBe('сегодня');
        expect(calcTherapyDuration('2026-09-27')).toBe('1 месяц');
      });
      withTimeZone('America/Los_Angeles', () => {
        expect(calcTherapyDuration('2026-10-27')).toBe('');
        expect(calcTherapyDuration('2026-09-27')).toBe('29 дней');
      });
    });
  });

  it('месяцы склоняются (1 месяц / 3 месяца / 5 месяцев)', () => {
    withNow('2026-02-15T00:00:00', () =>
      expect(calcTherapyDuration('2026-01-10T00:00:00')).toBe('1 месяц'),
    );
    withNow('2026-04-15T00:00:00', () =>
      expect(calcTherapyDuration('2026-01-10T00:00:00')).toBe('3 месяца'),
    );
    withNow('2026-06-15T00:00:00', () =>
      expect(calcTherapyDuration('2026-01-10T00:00:00')).toBe('5 месяцев'),
    );
  });
});

describe('nextSessionLabel', () => {
  // Год показывается, если он не текущий: часы закреплены за 2026 годом.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('дата без времени — «день недели, число месяц»', () => {
    // 2026-01-15 — четверг
    expect(nextSessionLabel('2026-01-15')).toBe('Чт, 15 янв');
  });

  it('дата со временем добавляет « · HH:MM»', () => {
    expect(nextSessionLabel('2026-01-15T18:30')).toBe('Чт, 15 янв · 18:30');
  });

  it('день недели тот же в любой зоне машины', () => {
    forEachTimeZone((tz) => {
      expect(nextSessionLabel('2026-01-15'), tz).toBe('Чт, 15 янв');
      expect(nextSessionLabel('2026-01-15T18:30'), tz).toBe(
        'Чт, 15 янв · 18:30',
      );
    });
  });

  it('нечитаемая дата — пусто, а не «undefined, NaN»', () => {
    expect(nextSessionLabel('мусор')).toBe('');
  });

  // QA 2026-10-26: сессия 2027-10-26 — «Вт, 26 окт · 10:00» при сегодняшнем
  // 26 окт 2026; «26 май» вместо «26 мая»; секунды из базы — «10:00:00».
  it('другой год — с годом; май — «мая»; время без секунд', () => {
    expect(nextSessionLabel('2027-10-26T10:00')).toBe(
      'Вт, 26 окт 2027 · 10:00',
    );
    expect(nextSessionLabel('2026-05-26')).toBe('Вт, 26 мая');
    expect(nextSessionLabel('2026-10-27T10:00:00')).toBe('Вт, 27 окт · 10:00');
  });
});

// QA 2026-10-26: «сегодня клиента» знает только сервер (его зона).
describe('isActiveToday', () => {
  it('только daysSinceActive === 0', () => {
    expect(isActiveToday({ daysSinceActive: 0 })).toBe(true);
    expect(isActiveToday({ daysSinceActive: 1 })).toBe(false);
    expect(isActiveToday({ daysSinceActive: null })).toBe(false);
    expect(isActiveToday({})).toBe(false); // старый кэш без поля
  });
});

// Сведение 2026-08: раньше indexColor жил в двух версиях (webapp: --c-* и
// порог 5; мини-апп: accent-* и порог 4) — карточка и спарклайн рядом
// красились по-разному. Канон — accent-версия, пороги 7/4.
describe('indexColor', () => {
  it('высокий индекс (≥7) — зелёный', () => {
    expect(indexColor(7)).toBe('#06d6a0');
    expect(indexColor(10)).toBe('#06d6a0');
  });
  it('средний (4–6.9) — жёлтый акцент', () => {
    expect(indexColor(4)).toBe('var(--accent-yellow)');
    expect(indexColor(6.9)).toBe('var(--accent-yellow)');
  });
  it('низкий (<4) — красный акцент', () => {
    expect(indexColor(3.9)).toBe('var(--accent-red)');
    expect(indexColor(0)).toBe('var(--accent-red)');
  });
});

describe('CONCEPT_FIELDS', () => {
  it('содержит goals — поле терялось в webapp до сведения', () => {
    expect(CONCEPT_FIELDS.map((f) => f.key)).toContain('goals');
  });
  it('ключи уникальны', () => {
    const keys = CONCEPT_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('isVirtualClient: id строкой (веб-аккаунт > 2^53)', () => {
  it('веб-клиент — не виртуальный, строковый отрицательный — виртуальный', () => {
    expect(isVirtualClient({ telegramId: '1000000000000000123' })).toBe(false);
    expect(isVirtualClient({ telegramId: '-3' })).toBe(true);
  });
});

describe('isVirtualClient', () => {
  it('отрицательный telegramId — офлайн-клиент', () => {
    expect(isVirtualClient({ telegramId: -3 })).toBe(true);
  });

  it('положительный telegramId — клиент из Telegram', () => {
    expect(isVirtualClient({ telegramId: 123456 })).toBe(false);
  });

  it('name не участвует: у офлайн-клиента оно непустое', () => {
    expect(
      isVirtualClient({ telegramId: -3, name: 'Борис' } as {
        telegramId: number;
      }),
    ).toBe(true);
  });
});
