// tz.ts — таймзон-хелперы, на которых стоит вся логика уведомлений/трекеров
// (notifyTimezone юзера). Значения ниже посчитаны прогоном самого алгоритма
// (round-trip через Intl.DateTimeFormat), а не переформулированы вручную —
// см. localMidnightUTC: конвертирует «полночь по местному времени» в UTC,
// вычисляя оффсет через двойное форматирование.
import { localDate, localMidnightUTC, zonedWallClockToUtc } from './tz';

/**
 * Перехватывает строковые аргументы `new Date(строка)`, вызванные внутри fn.
 *
 * Зачем: часть мутантов Stryker на tz.ts (удаление суффикса 'Z', подмена
 * литерала 'T') в этой песочнице не меняют ИТОГОВОЕ значение даты — процесс
 * всегда в TZ=UTC (см. комментарий в caldav-busy.spec.ts: process.env.TZ
 * внутри jest не пробрасывается в V8), поэтому «локальный» разбор строки без
 * 'Z' здесь случайно совпадает с UTC-разбором. Ловим такие мутанты не по
 * итоговому Date, а по точной строке, которую код реально строит перед
 * парсингом — так регрессия видна независимо от зоны процесса.
 */
function captureDateStrings(fn: () => void): string[] {
  const RealDate = Date;
  const seen: string[] = [];
  const ProxyDate = new Proxy(RealDate, {
    construct(target, args: [string?]) {
      if (args.length === 1 && typeof args[0] === 'string') seen.push(args[0]);
      return Reflect.construct(target, args);
    },
  });
  // eslint-disable-next-line no-global-assign
  Date = ProxyDate;
  try {
    fn();
  } finally {
    // eslint-disable-next-line no-global-assign
    Date = RealDate;
  }
  return seen;
}

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

  // Второй проход в zonedWallClockToUtc существует специально ради момента,
  // близкого к DST-переходу: первая (грубая) оценка смещения может «упасть»
  // не в ту сторону от границы перехода, и второй проход её поправляет.
  // Мутация `-` → `+` в первом проходе (стр.34) не всегда видна на самих
  // датах перехода (00:00 не пересекает границу даже с удвоенным по знаку
  // смещением) — берём момент СРАЗУ ПОСЛЕ перевода стрелок, где удвоенная
  // ошибка знака уводит грубую оценку через границу 02:00→03:00 EDT.
  it('DST-переход America/New_York: время сразу после перевода стрелок (03:01 EDT) переводится в UTC верно', () => {
    expect(
      zonedWallClockToUtc(
        '2026-03-08T03:01:00',
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-03-08T07:01:00.000Z');
  });

  // Мутанты StringLiteral на стр.28 ('T' → '', 'Z' → '') и стр.45 ('Z' → '')
  // не меняют итоговое значение Date в этой песочнице (TZ=UTC — см.
  // captureDateStrings выше), поэтому проверяем не итог, а фактически
  // построенную строку перед разбором `new Date(...)`.
  it('внутренняя "наивная" дата собирается как <ISO>T00:00:00Z для date-only входа (не теряет ни "T", ни завершающий "Z")', () => {
    const seen = captureDateStrings(() => {
      zonedWallClockToUtc('2026-01-15', 'UTC');
    });
    expect(seen[0]).toBe('2026-01-15T00:00:00Z');
  });

  it('внутренняя строка стенного времени зоны в zoneOffsetMs оканчивается на "Z" (без него строка ушла бы в зону процесса, а не осталась UTC)', () => {
    const seen = captureDateStrings(() => {
      zonedWallClockToUtc('2026-01-15', 'Europe/Moscow');
    });
    // seen[1] — первый вызов zoneOffsetMs(fmt, naive): стенное время в
    // Москве (+3) для полуночи 15-го — 03:00 того же дня.
    expect(seen[1]).toBe('2026-01-15T03:00:00Z');
  });
});

describe('zoneFormatter — кэш форматтера по зоне', () => {
  it('второй вызов с той же зоной переиспользует форматтер, а не создаёт новый Intl.DateTimeFormat', () => {
    // Мутация `if (cached) return cached;` → `if (false) ...` (стр.54)
    // отключает кэш — форматтер создавался бы заново на каждый вызов.
    // Зона выбрана не пересекающейся с другими тестами файла, чтобы не
    // словить чужой прогрев кэша (formatterCache общий на модуль).
    const constructorSpy = jest.spyOn(Intl, 'DateTimeFormat');
    try {
      const first = localMidnightUTC('2026-05-01', 'Asia/Tokyo');
      const second = localMidnightUTC('2026-05-01', 'Asia/Tokyo');
      const third = localMidnightUTC('2026-05-03', 'Asia/Tokyo');
      expect(constructorSpy).toHaveBeenCalledTimes(1);
      // Не только «конструктор звался один раз» — переиспользованный
      // форматтер обязан считать те же стенные часы, а не что попало.
      // Токио без DST: полночь = UTC-15:00 предыдущего дня.
      expect(second.toISOString()).toBe(first.toISOString());
      expect(first.toISOString()).toBe('2026-04-30T15:00:00.000Z');
      expect(third.toISOString()).toBe('2026-05-02T15:00:00.000Z');
    } finally {
      constructorSpy.mockRestore();
    }
  });
});
