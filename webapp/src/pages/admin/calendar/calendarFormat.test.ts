// Текст для экрана календаря — чистые функции, без jsdom. Рядом с
// calendarFormat.ts (правило №10 CLAUDE.md: тесты у вынесенного модуля
// переезжают вместе с ним, а не остаются в calendarModel.test.ts).
import { describe, it, expect } from 'vitest';
import type { AdminCalendarCell } from '../../../api';
import {
  chipLabel,
  dayStatus,
  fmtChipTime,
  fmtDayTitle,
  fmtWeekTitle,
  stateLabel,
} from './calendarFormat';

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

describe('chipLabel', () => {
  it('обычная (не прошедшая) ячейка — слово состояния как у stateLabel', () => {
    expect(chipLabel(cell({ state: 'free' }))).toBe('свободно');
    expect(chipLabel(cell({ state: 'blocked' }))).toBe('закрыто вручную');
    expect(chipLabel(cell({ state: 'off' }))).toBe('вне расписания');
  });

  it('прошедшая не-booked ячейка — «прошло» независимо от исходного state', () => {
    for (const state of ['free', 'busy', 'blocked', 'extra', 'off'] as const) {
      expect(chipLabel(cell({ state, past: true })), state).toBe('прошло');
    }
  });

  it('прошедшая booked остаётся «бронь» — это история дня, а не предложение записи', () => {
    expect(
      chipLabel(cell({ state: 'booked', past: true, booking: { id: 1, clientName: 'Аня', status: 'CONFIRMED' } })),
    ).toBe('бронь');
  });
});

describe('dayStatus', () => {
  it('нет ячеек — пустая строка (DayCard сам покажет «Ячеек нет»)', () => {
    expect(dayStatus([])).toBe('');
  });

  it('все ячейки дня прошли — «прошло», не «свободных нет»', () => {
    const cells = [
      cell({ startsAt: 'a', state: 'free', past: true }),
      cell({ startsAt: 'b', state: 'blocked', past: true }),
    ];
    expect(dayStatus(cells)).toBe('прошло');
  });

  it('есть свободные/открытые вручную в будущем — число, прошедшие не в счёт', () => {
    const cells = [
      cell({ startsAt: 'a', state: 'free' }),
      cell({ startsAt: 'b', state: 'extra' }),
      cell({ startsAt: 'c', state: 'busy', past: true }),
    ];
    expect(dayStatus(cells)).toBe('2 свободно');
  });

  it('будущие ячейки есть, но ни одна не свободна — «свободных нет»', () => {
    const cells = [
      cell({ startsAt: 'a', state: 'blocked' }),
      cell({ startsAt: 'b', state: 'free', past: true }),
    ];
    expect(dayStatus(cells)).toBe('свободных нет');
  });
});
