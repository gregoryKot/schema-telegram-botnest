// Чистые функции — без jsdom (нет React/DOM). Даты через forEachTimeZone —
// правило №25 CLAUDE.md: календарный день = полночь UTC, результат не
// должен зависеть от зоны процесса (инцидент 2026-09-17).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { forEachTimeZone } from '../../../../../shared/src/utils/timeZone.test-helpers';
import type { AdminCalendarCell } from '../../../api';
import {
  cellAction,
  dayAction,
  fmtChipTime,
  fmtDayTitle,
  fmtWeekTitle,
  shiftWeek,
  stateLabel,
  todayIn,
  weekRange,
} from './calendarModel';

function cell(overrides: Partial<AdminCalendarCell> = {}): AdminCalendarCell {
  return {
    startsAt: '2026-09-21T07:00:00.000Z',
    durationMin: 50,
    state: 'free',
    busy: false,
    past: false,
    ...overrides,
  };
}

describe('weekRange', () => {
  it('среда и воскресенье той же недели дают одну и ту же неделю (Пн..Вс)', () => {
    forEachTimeZone((tz) => {
      expect(weekRange('2026-09-16'), tz).toEqual({ from: '2026-09-14', to: '2026-09-20' });
      expect(weekRange('2026-09-20'), tz).toEqual({ from: '2026-09-14', to: '2026-09-20' }); // воскресенье — конец ТОЙ ЖЕ недели
    });
  });

  it('неделя через границу месяца', () => {
    forEachTimeZone((tz) => {
      expect(weekRange('2026-09-29'), tz).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    });
  });

  it('неделя через границу года — 31 декабря и 1 января в одной неделе', () => {
    forEachTimeZone((tz) => {
      expect(weekRange('2026-12-28'), tz).toEqual({ from: '2026-12-28', to: '2027-01-03' });
      expect(weekRange('2026-12-31'), tz).toEqual({ from: '2026-12-28', to: '2027-01-03' });
      expect(weekRange('2027-01-01'), tz).toEqual({ from: '2026-12-28', to: '2027-01-03' });
    });
  });
});

describe('shiftWeek', () => {
  it('вперёд и назад на 7 дней, понедельник остаётся понедельником', () => {
    forEachTimeZone((tz) => {
      expect(shiftWeek('2026-09-14', 1), tz).toEqual({ from: '2026-09-21', to: '2026-09-27' });
      expect(shiftWeek('2026-09-14', -1), tz).toEqual({ from: '2026-09-07', to: '2026-09-13' });
      expect(shiftWeek('2026-09-14', 0), tz).toEqual({ from: '2026-09-14', to: '2026-09-20' });
    });
  });

  it('сдвиг через границу года', () => {
    forEachTimeZone((tz) => {
      expect(shiftWeek('2026-12-28', 1), tz).toEqual({ from: '2027-01-04', to: '2027-01-10' });
    });
  });
});

describe('todayIn', () => {
  afterEach(() => vi.useRealTimers());

  it('дата в переданной зоне, не в зоне процесса — 23:30 UTC уже завтра в Сиднее', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T23:30:00.000Z'));
    forEachTimeZone((tz) => {
      expect(todayIn('UTC'), tz).toBe('2026-01-01');
      expect(todayIn('Australia/Sydney'), tz).toBe('2026-01-02');
      expect(todayIn('America/Los_Angeles'), tz).toBe('2026-01-01');
    });
  });
});

describe('cellAction', () => {
  it('free → закрыть (set BLOCK)', () => {
    expect(cellAction(cell({ state: 'free' }))).toEqual({
      set: [{ startsAt: '2026-09-21T07:00:00.000Z', durationMin: 50, kind: 'BLOCK' }],
    });
  });

  it('busy → закрыть насовсем (тот же set BLOCK, что и free)', () => {
    expect(cellAction(cell({ state: 'busy', busy: true }))).toEqual({
      set: [{ startsAt: '2026-09-21T07:00:00.000Z', durationMin: 50, kind: 'BLOCK' }],
    });
  });

  it('blocked → открыть (clear)', () => {
    expect(cellAction(cell({ state: 'blocked' }))).toEqual({ clear: ['2026-09-21T07:00:00.000Z'] });
  });

  it('extra → убрать (clear)', () => {
    expect(cellAction(cell({ state: 'extra' }))).toEqual({ clear: ['2026-09-21T07:00:00.000Z'] });
  });

  it('blocked по пересечению — clear идёт по startsAt самой строки BLOCK, а не ячейки', () => {
    // BLOCK 07:30 накрывает ячейку 07:00–07:50; строки с startsAt 07:00 в БД нет —
    // clear по ней был бы тихим no-op, и «открыть» не срабатывало бы.
    expect(cellAction(cell({ state: 'blocked', overrideStartsAt: '2026-09-21T07:30:00.000Z' }))).toEqual({
      clear: ['2026-09-21T07:30:00.000Z'],
    });
  });

  it('off → открыть разово (set OPEN)', () => {
    expect(cellAction(cell({ state: 'off' }))).toEqual({
      set: [{ startsAt: '2026-09-21T07:00:00.000Z', durationMin: 50, kind: 'OPEN' }],
    });
  });

  it('booked → null (отменять — во вкладке «Записи»)', () => {
    expect(cellAction(cell({ state: 'booked', booking: { id: 1, clientName: 'Аня', status: 'CONFIRMED' } }))).toBeNull();
  });

  it('past → null независимо от state', () => {
    for (const state of ['free', 'busy', 'blocked', 'extra', 'off', 'booked'] as const) {
      expect(cellAction(cell({ state, past: true })), state).toBeNull();
    }
  });
});

describe('dayAction', () => {
  it('день из одних off/booked/прошедших — нет действия', () => {
    const cells = [
      cell({ startsAt: 'a', state: 'off' }),
      cell({ startsAt: 'b', state: 'booked' }),
      cell({ startsAt: 'c', state: 'free', past: true }),
    ];
    expect(dayAction(cells)).toBeNull();
  });

  it('есть свободные/занятые/лишние — «Закрыть день»: BLOCK для free/busy, clear для extra', () => {
    const cells = [
      cell({ startsAt: 'free1', state: 'free' }),
      cell({ startsAt: 'busy1', state: 'busy', busy: true }),
      cell({ startsAt: 'extra1', state: 'extra' }),
      cell({ startsAt: 'off1', state: 'off' }),
    ];
    const result = dayAction(cells);
    expect(result?.label).toBe('Закрыть день');
    expect(result?.patch.set).toEqual(
      expect.arrayContaining([
        { startsAt: 'free1', durationMin: 50, kind: 'BLOCK' },
        { startsAt: 'busy1', durationMin: 50, kind: 'BLOCK' },
      ]),
    );
    expect(result?.patch.set).toHaveLength(2);
    expect(result?.patch.clear).toEqual(['extra1']);
  });

  it('прошедшие ячейки день-действие не трогает', () => {
    const cells = [
      cell({ startsAt: 'past-free', state: 'free', past: true }),
      cell({ startsAt: 'live-free', state: 'free' }),
    ];
    const result = dayAction(cells);
    expect(result?.patch.set).toEqual([{ startsAt: 'live-free', durationMin: 50, kind: 'BLOCK' }]);
  });

  it('только lishние (extra) — patch без set, только clear', () => {
    const cells = [cell({ startsAt: 'extra1', state: 'extra' }), cell({ startsAt: 'extra2', state: 'extra' })];
    const result = dayAction(cells);
    expect(result?.patch.set).toBeUndefined();
    expect(result?.patch.clear).toEqual(['extra1', 'extra2']);
  });

  it('нет free/busy/extra, но есть закрытые — «Открыть день»: clear всех blocked', () => {
    const cells = [
      cell({ startsAt: 'b1', state: 'blocked' }),
      cell({ startsAt: 'b2', state: 'blocked' }),
      cell({ startsAt: 'off1', state: 'off' }),
    ];
    const result = dayAction(cells);
    expect(result).toEqual({ label: 'Открыть день', patch: { clear: ['b1', 'b2'] } });
  });

  it('«Открыть день»: один BLOCK на две ячейки — ключ снятия один, без дублей', () => {
    const cells = [
      cell({ startsAt: 'b1', state: 'blocked', overrideStartsAt: 'blk' }),
      cell({ startsAt: 'b2', state: 'blocked', overrideStartsAt: 'blk' }),
      cell({ startsAt: 'b3', state: 'blocked' }),
    ];
    expect(dayAction(cells)).toEqual({ label: 'Открыть день', patch: { clear: ['blk', 'b3'] } });
  });

  it('прошедшая blocked-ячейка в «Открыть день» не попадает', () => {
    const cells = [cell({ startsAt: 'b1', state: 'blocked', past: true })];
    expect(dayAction(cells)).toBeNull();
  });
});

describe('fmt*', () => {
  it('fmtChipTime — HH:mm в переданной зоне', () => {
    expect(fmtChipTime('2026-09-21T07:00:00.000Z', 'Europe/Moscow')).toBe('10:00');
    expect(fmtChipTime('2026-09-21T07:00:00.000Z', 'UTC')).toBe('07:00');
  });

  it('fmtDayTitle — «Пн 21 сен»', () => {
    expect(fmtDayTitle('2026-09-21')).toBe('Пн 21 сен');
  });

  it('fmtDayTitle — нечитаемая строка не падает, отдаёт пустоту', () => {
    expect(fmtDayTitle('мусор')).toBe('');
  });

  it('fmtWeekTitle — внутри месяца, без повторного месяца в начале', () => {
    expect(fmtWeekTitle('2026-09-21', '2026-09-27')).toBe('21–27 сентября');
  });

  it('fmtWeekTitle — на стыке месяцев, месяц у каждой даты свой', () => {
    expect(fmtWeekTitle('2026-09-28', '2026-10-04')).toBe('28 сентября – 4 октября');
  });

  it('fmtWeekTitle — на стыке годов ведёт себя как обычный стык месяцев', () => {
    expect(fmtWeekTitle('2026-12-28', '2027-01-03')).toBe('28 декабря – 3 января');
  });
});

describe('stateLabel', () => {
  it('слово для каждого состояния', () => {
    expect(stateLabel('free')).toBe('свободно');
    expect(stateLabel('busy')).toBe('встреча в календаре');
    expect(stateLabel('booked')).toBe('бронь');
    expect(stateLabel('blocked')).toBe('закрыто вручную');
    expect(stateLabel('extra')).toBe('открыто вручную');
    expect(stateLabel('off')).toBe('вне расписания');
  });
});
