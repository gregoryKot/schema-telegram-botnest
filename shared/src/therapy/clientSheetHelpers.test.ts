// Хелперы карточки клиента жили копией в webapp и мини-аппе (правило №3),
// сведены в shared. Тест держит склеенную логику: русская плюрализация
// длительности и формат «день недели, число месяц · время».
import { describe, it, expect, afterEach, vi } from 'vitest';
import { calcTherapyDuration, nextSessionLabel } from './clientSheetHelpers';

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
  it('дата без времени — «день недели, число месяц»', () => {
    // 2026-01-15 — четверг
    expect(nextSessionLabel('2026-01-15')).toBe('Чт, 15 янв');
  });

  it('дата со временем добавляет « · HH:MM»', () => {
    expect(nextSessionLabel('2026-01-15T18:30')).toBe('Чт, 15 янв · 18:30');
  });
});
