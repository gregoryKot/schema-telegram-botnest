// tz.ts — таймзон-хелперы, на которых стоит вся логика уведомлений/трекеров
// (notifyTimezone юзера). Значения ниже посчитаны прогоном самого алгоритма
// (round-trip через Intl.DateTimeFormat), а не переформулированы вручную —
// см. localMidnightUTC: конвертирует «полночь по местному времени» в UTC,
// вычисляя оффсет через двойное форматирование.
import { localDate, localMidnightUTC } from './tz';

describe('localDate', () => {
  it('UTC: дата совпадает с UTC-датой инстанта', () => {
    expect(localDate('UTC', new Date('2026-01-15T12:00:00Z'))).toBe(
      '2026-01-15',
    );
  });

  it('положительный оффсет (Europe/Moscow, UTC+3): вечер UTC уже следующий день по МСК', () => {
    expect(localDate('Europe/Moscow', new Date('2026-01-15T22:00:00Z'))).toBe(
      '2026-01-16',
    );
  });

  it('отрицательный оффсет (America/New_York): раннее утро UTC — ещё предыдущий день', () => {
    expect(
      localDate('America/New_York', new Date('2026-01-15T02:00:00Z')),
    ).toBe('2026-01-14');
  });

  it('невалидная IANA-таймзона — функция не глотает ошибку, а бросает RangeError', () => {
    // В tz.ts нет try/catch и фолбэка на дефолтную таймзону — вызывающий
    // код (bot.service.ts и т.п.) обязан подставлять 'Europe/Moscow' сам
    // через `?? 'Europe/Moscow'` ДО вызова. Тест фиксирует текущее
    // поведение, чтобы регрессия (например, попытка добавить фолбэк внутрь
    // и сломать его) была замечена.
    expect(() => localDate('Not/AZone', new Date())).toThrow(RangeError);
  });

  it('без второго аргумента берёт текущий момент (дефолт base = new Date())', () => {
    // Дефолтный параметр — отдельная ветка; вызываем без base, чтобы она
    // была покрыта, а не проседала в общем coverage-храповике. Сравнивать с
    // повторным вызовом нельзя — на границе полуночи UTC два new Date() дадут
    // разные даты (флак); проверяем только формат.
    expect(localDate('UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('localMidnightUTC', () => {
  it('UTC: местная полночь = UTC-полночь той же даты', () => {
    expect(localMidnightUTC('2026-01-15', 'UTC').toISOString()).toBe(
      '2026-01-15T00:00:00.000Z',
    );
  });

  it('Europe/Moscow (UTC+3, без DST): местная полночь на 3 часа раньше по UTC', () => {
    expect(localMidnightUTC('2026-01-15', 'Europe/Moscow').toISOString()).toBe(
      '2026-01-14T21:00:00.000Z',
    );
  });

  it('America/New_York зимой (EST, UTC-5): местная полночь на 5 часов позже по UTC', () => {
    expect(
      localMidnightUTC('2026-01-15', 'America/New_York').toISOString(),
    ).toBe('2026-01-15T05:00:00.000Z');
  });

  it('DST-переход America/New_York: до перевода стрелок (EST, UTC-5)', () => {
    // Стрелки переводятся 2026-03-08 в 02:00 EST → 03:00 EDT. Полночь этого
    // дня ещё в EST-режиме.
    expect(
      localMidnightUTC('2026-03-08', 'America/New_York').toISOString(),
    ).toBe('2026-03-08T05:00:00.000Z');
  });

  it('DST-переход America/New_York: на следующий день уже EDT (UTC-4)', () => {
    expect(
      localMidnightUTC('2026-03-09', 'America/New_York').toISOString(),
    ).toBe('2026-03-09T04:00:00.000Z');
  });

  it('Europe/Moscow не переводит стрелки — оффсет одинаковый по обе стороны даты старого DST-перехода', () => {
    // Россия отменила переход на летнее время — offset должен остаться +3
    // и до, и после дат, где раньше был бы переход у других стран.
    expect(localMidnightUTC('2026-03-29', 'Europe/Moscow').toISOString()).toBe(
      '2026-03-28T21:00:00.000Z',
    );
    expect(localMidnightUTC('2026-03-30', 'Europe/Moscow').toISOString()).toBe(
      '2026-03-29T21:00:00.000Z',
    );
  });

  it('невалидная таймзона — бросает RangeError, а не тихо использует UTC', () => {
    expect(() => localMidnightUTC('2026-01-15', 'Not/AZone')).toThrow(
      RangeError,
    );
  });
});
