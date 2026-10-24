// Форматирование дат — единственная копия для обоих фронтендов. Проверяем
// границы месяцев (январь/декабрь) и отсутствие сдвига часового пояса
// (парсинг строки руками, а не через new Date, который мог бы съехать).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fmtDate, fmtDateLong, todayStr, fmtAgo } from './format';
import { forEachTimeZone, withTimeZone } from './timeZone.test-helpers';

afterEach(() => {
  vi.useRealTimers();
});

describe('fmtDate', () => {
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
