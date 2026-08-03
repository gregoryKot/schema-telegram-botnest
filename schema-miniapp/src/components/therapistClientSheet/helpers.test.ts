// Хелперы кабинета терапевта: длительность терапии, метка следующей сессии,
// цвет индекса. Много ветвлений с русской плюрализацией (день/дня/дней,
// месяц/месяца/месяцев) — регресс здесь незаметен глазом, только тестом.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { calcTherapyDuration, nextSessionLabel, indexColor } from './helpers';

afterEach(() => {
  vi.useRealTimers();
});

describe('calcTherapyDuration', () => {
  it('меньше суток — "сегодня"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T12:00:00Z'));
    expect(calcTherapyDuration('2026-08-03T08:00:00Z')).toBe('сегодня');
  });

  it('1 день — единственное число "день"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));
    expect(calcTherapyDuration('2026-08-03T12:00:00Z')).toBe('1 день');
  });

  it('3 дня — форма "дня"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-06T12:00:00Z'));
    expect(calcTherapyDuration('2026-08-03T12:00:00Z')).toBe('3 дня');
  });

  it('11 дней — форма "дней" (исключение 11-19)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T12:00:00Z'));
    expect(calcTherapyDuration('2026-08-03T12:00:00Z')).toBe('11 дней');
  });

  it('1 месяц — единственное число', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-03T12:00:00Z'));
    expect(calcTherapyDuration('2026-08-03T12:00:00Z')).toBe('1 месяц');
  });

  it('3 месяца — форма "месяца"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
    expect(calcTherapyDuration('2026-08-03T12:00:00Z')).toBe('3 месяца');
  });
});

describe('nextSessionLabel', () => {
  it('форматирует дату без времени', () => {
    // 2026-08-10 — понедельник
    expect(nextSessionLabel('2026-08-10')).toBe('Пн, 10 авг');
  });

  it('форматирует дату со временем через ISO-строку', () => {
    expect(nextSessionLabel('2026-08-10T15:30:00')).toBe(
      'Пн, 10 авг · 15:30:00',
    );
  });
});

describe('indexColor', () => {
  it('высокий индекс (>=7) — зелёный', () => {
    expect(indexColor(7)).toBe('#06d6a0');
    expect(indexColor(10)).toBe('#06d6a0');
  });

  it('средний индекс (4-6) — жёлтый', () => {
    expect(indexColor(4)).toBe('var(--accent-yellow)');
    expect(indexColor(6)).toBe('var(--accent-yellow)');
  });

  it('низкий индекс (<4) — красный', () => {
    expect(indexColor(0)).toBe('var(--accent-red)');
    expect(indexColor(3)).toBe('var(--accent-red)');
  });
});
