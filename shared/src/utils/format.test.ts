// Форматирование дат — единственная копия для обоих фронтендов. Проверяем
// границы месяцев (январь/декабрь) и отсутствие сдвига часового пояса
// (парсинг строки руками, а не через new Date, который мог бы съехать).
import { describe, it, expect } from 'vitest';
import { fmtDate, fmtDateLong, todayStr } from './format';

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
