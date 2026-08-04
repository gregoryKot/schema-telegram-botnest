// Хелперы кабинета терапевта: длительность терапии, метка следующей сессии,
// цвет индекса. Много ветвлений с русской плюрализацией (день/дня/дней,
// месяц/месяца/месяцев) — регресс здесь незаметен глазом, только тестом.
// (см. парный файл schema-miniapp/src/components/therapistClientSheet/helpers.test.ts —
// логика идентична по смыслу, но не байтовая пара: webapp-версия компактнее
// форматированием и thresholds indexColor отличаются от миниаппа.)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { calcTherapyDuration, nextSessionLabel, indexColor } from './clientSheetHelpers';

afterEach(() => {
  vi.useRealTimers();
});

describe('calcTherapyDuration', () => {
  it('меньше суток — "сегодня"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    expect(calcTherapyDuration('2026-08-15T08:00:00Z')).toBe('сегодня');
  });

  it('1 день — единственное число "день"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    expect(calcTherapyDuration('2026-08-14T12:00:00Z')).toBe('1 день');
  });

  it('3 дня — форма "дня"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    expect(calcTherapyDuration('2026-08-12T12:00:00Z')).toBe('3 дня');
  });

  it('5 дней — форма "дней" (обычное множественное)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    expect(calcTherapyDuration('2026-08-10T12:00:00Z')).toBe('5 дней');
  });

  it('11 дней — форма "дней" (исключение 11-19 перекрывает m10===1)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    expect(calcTherapyDuration('2026-08-04T12:00:00Z')).toBe('11 дней');
  });

  it('1 месяц — единственное число', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));
    expect(calcTherapyDuration('2026-08-01T00:00:00Z')).toBe('1 месяц');
  });

  it('3 месяца — форма "месяца"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T00:00:00Z'));
    expect(calcTherapyDuration('2026-08-01T00:00:00Z')).toBe('3 месяца');
  });

  it('5 месяцев — форма "месяцев" (обычное множественное)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-01T00:00:00Z'));
    expect(calcTherapyDuration('2026-08-01T00:00:00Z')).toBe('5 месяцев');
  });

  it('11 месяцев — форма "месяцев" (исключение 11-19)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-07-01T00:00:00Z'));
    expect(calcTherapyDuration('2026-08-01T00:00:00Z')).toBe('11 месяцев');
  });
});

describe('nextSessionLabel', () => {
  it('форматирует дату без времени', () => {
    // 2026-08-10 — понедельник
    expect(nextSessionLabel('2026-08-10')).toBe('Пн, 10 авг');
  });

  it('форматирует дату со временем через ISO-строку', () => {
    expect(nextSessionLabel('2026-08-10T15:30:00')).toBe('Пн, 10 авг · 15:30:00');
  });
});

describe('indexColor', () => {
  it('высокий индекс (>=7) — акцент moss', () => {
    expect(indexColor(7)).toBe('var(--c-moss)');
    expect(indexColor(10)).toBe('var(--c-moss)');
  });

  it('средний индекс (5-6) — обычный текст', () => {
    expect(indexColor(5)).toBe('var(--text)');
    expect(indexColor(6)).toBe('var(--text)');
  });

  it('низкий индекс (<5) — акцент rose', () => {
    expect(indexColor(0)).toBe('var(--c-rose)');
    expect(indexColor(4)).toBe('var(--c-rose)');
  });
});
