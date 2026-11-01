// Форматирование дат — единственная копия для обоих фронтендов. Проверяем
// границы месяцев (январь/декабрь) и отсутствие сдвига часового пояса
// (парсинг строки руками, а не через new Date, который мог бы съехать).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { fmtDate, fmtDateLong, todayStr, fmtAgo } from './format';
import { forEachTimeZone, withTimeZone } from './timeZone.test-helpers';

afterEach(() => {
  vi.useRealTimers();
});

// fmtDate показывает год, если он не текущий — «текущий» берётся от часов,
// поэтому часы в этих тестах закреплены за 2026 годом.
const pin2026 = () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
};

describe('fmtDate', () => {
  beforeEach(pin2026);
  it('короткая дата: день + сокращённый месяц', () => {
    expect(fmtDate('2026-04-07')).toBe('7 апр');
  });

  it('границы года: январь и декабрь', () => {
    expect(fmtDate('2026-01-01')).toBe('1 янв');
    expect(fmtDate('2026-12-31')).toBe('31 дек');
  });

  it('ведущий ноль дня не остаётся в выводе', () => {
    expect(fmtDate('2026-07-05')).toBe('5 июл');
  });

  // QA 2026-10-26: «26 май» — месяц после числа стоит в родительном падеже.
  it('май после числа — «мая»', () => {
    expect(fmtDate('2026-05-26')).toBe('26 мая');
  });

  // QA 2026-10-26: следующая сессия 2027-10-26 показывалась «26 окт» при
  // сегодняшнем 26 окт 2026, начало терапии 2025-09-26 — «26 сен».
  it('другой год — с годом, текущий — без', () => {
    expect(fmtDate('2027-10-26')).toBe('26 окт 2027');
    expect(fmtDate('2025-09-26')).toBe('26 сен 2025');
    expect(fmtDate('2026-10-26')).toBe('26 окт');
  });

  // «Текущий год» — год местного сегодня того, кто смотрит: в 22:00 UTC
  // 31 декабря в Сиднее и Иерусалиме уже 2027-й, в UTC и Лос-Анджелесе — 2026-й.
  it('текущий год — по местному дню читателя', () => {
    vi.setSystemTime(new Date('2026-12-31T22:30:00Z'));
    forEachTimeZone((tz) => {
      const newYear = tz === 'Australia/Sydney' || tz === 'Asia/Jerusalem';
      expect(fmtDate('2026-12-31'), tz).toBe(
        newYear ? '31 дек 2026' : '31 дек',
      );
      expect(fmtDate('2027-01-01'), tz).toBe(newYear ? '1 янв' : '1 янв 2027');
    });
  });
});

describe('fmtDateLong', () => {
  it('полное название месяца в родительном падеже', () => {
    expect(fmtDateLong('2026-04-07')).toBe('7 апреля');
    expect(fmtDateLong('2026-01-01')).toBe('1 января');
  });
});

describe('todayStr', () => {
  it('формат YYYY-MM-DD, совпадает с локальной датой на момент вызова', () => {
    const s = todayStr();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    expect(s.slice(0, 4)).toBe(String(now.getFullYear()));
  });
});

// fmtAgo считает разницу двух МОМЕНТОВ в миллисекундах, поэтому «сегодня /
// вчера / N дн. назад» обязаны совпадать в любой зоне машины: данные у сайта
// и мини-аппа общие (правило №25). Прогон по зонам внутри теста краснеет на
// любой машине, а не только во второй CI-джобе.
describe('fmtAgo', () => {
  // toFake: ['Date'] — подменяем только часы, таймеры vitest не трогаем.
  const agoAt = (now: string, then: string): string => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(now));
    return fmtAgo(then);
  };

  it('тот же день — «сегодня», в любой зоне', () => {
    forEachTimeZone((tz) => {
      expect(agoAt('2026-08-03T12:00:00Z', '2026-08-03T08:00:00Z'), tz).toBe(
        'сегодня',
      );
    });
  });

  it('сутки назад — «вчера», в любой зоне', () => {
    forEachTimeZone((tz) => {
      expect(agoAt('2026-08-04T12:00:00Z', '2026-08-03T12:00:00Z'), tz).toBe(
        'вчера',
      );
    });
  });

  it('от двух до шести суток — «N дн. назад», в любой зоне', () => {
    forEachTimeZone((tz) => {
      expect(agoAt('2026-08-05T12:00:00Z', '2026-08-03T12:00:00Z'), tz).toBe(
        '2 дн. назад',
      );
      expect(agoAt('2026-08-08T12:00:00Z', '2026-08-03T12:00:00Z'), tz).toBe(
        '5 дн. назад',
      );
    });
  });

  it('неделя и больше — дата коротким месяцем', () => {
    forEachTimeZone((tz) => {
      expect(agoAt('2026-08-20T12:00:00Z', '2026-08-03T12:00:00Z'), tz).toBe(
        '3 авг.',
      );
    });
  });

  // Давняя дата — это момент, и показывается он в зоне читателя (правило
  // №25): в Сиднее 23:00 UTC уже следующие сутки. Пин на случай, если кто-то
  // решит «починить» вывод на UTC.
  it('давний момент у полуночи показывается в зоне читателя', () => {
    const shownAt = (tz: string) =>
      withTimeZone(tz, () =>
        agoAt('2026-08-20T12:00:00Z', '2026-08-03T23:00:00Z'),
      );
    expect(shownAt('Australia/Sydney')).toBe('4 авг.');
    expect(shownAt('America/Los_Angeles')).toBe('3 авг.');
  });
});
