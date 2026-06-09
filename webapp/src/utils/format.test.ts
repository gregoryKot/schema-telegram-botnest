import { describe, it, expect, afterEach, vi } from 'vitest';
import { fmtDate, fmtDateLong, todayStr } from './format';

describe('fmtDate', () => {
  it('форматирует короткую дату без сдвига таймзоны', () => {
    expect(fmtDate('2026-04-07')).toBe('7 апр');
  });

  it('убирает ведущий ноль у дня', () => {
    expect(fmtDate('2026-01-01')).toBe('1 янв');
  });

  it('берёт правильный месяц для декабря', () => {
    expect(fmtDate('2026-12-31')).toBe('31 дек');
  });
});

describe('fmtDateLong', () => {
  it('форматирует длинную дату в родительном падеже', () => {
    expect(fmtDateLong('2026-04-07')).toBe('7 апреля');
  });

  it('обрабатывает май', () => {
    expect(fmtDateLong('2026-05-15')).toBe('15 мая');
  });
});

describe('todayStr', () => {
  afterEach(() => vi.useRealTimers());

  it('возвращает YYYY-MM-DD в локальной таймзоне', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 8, 12, 0, 0));
    expect(todayStr()).toBe('2026-06-08');
  });

  it('добавляет ведущие нули к месяцу и дню', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 3, 12, 0, 0));
    expect(todayStr()).toBe('2026-01-03');
  });
});
