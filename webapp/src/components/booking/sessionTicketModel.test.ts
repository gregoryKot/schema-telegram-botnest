import { describe, it, expect } from 'vitest';
import { ticketWhen } from './sessionTicketModel';

describe('ticketWhen — строка «когда» на корешок билета', () => {
  it.each([
    ['Вс, 15 ноя · 18:00', 'Вс, 15 ноя', ' · ', '18:00'],
    ['Завтра, 16:00', 'Завтра', ', ', '16:00'],
    ['сб, 14 нояб., 9:30', 'сб, 14 нояб.', ', ', '9:30'],
    ['Сб, 31 окт 2027 · 07:00', 'Сб, 31 окт 2027', ' · ', '07:00'],
  ])('%s', (when, day, sep, time) => {
    const got = ticketWhen(when);
    expect(got).toEqual({ day, sep, time });
    expect(got.day + got.sep + got.time).toBe(when);
  });

  it.each(['Вс, 15 ноя', '', '18:00'])('без времени в хвосте — строка целиком в дне: «%s»', (when) => {
    expect(ticketWhen(when)).toEqual({ day: when, sep: '', time: null });
  });
});
