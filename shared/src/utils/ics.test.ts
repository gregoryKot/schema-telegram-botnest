// buildPracticeIcs/practiceIcsDataUrl — чистая генерация .ics для PlanSheet,
// общая для webapp и мини-аппа (правило №3, паритет фич правило №16).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildPracticeIcs, practiceIcsDataUrl } from './ics';
import { planEventStartMs } from './planEventStart';

describe('buildPracticeIcs', () => {
  it('содержит базовую структуру VCALENDAR/VEVENT с текстом практики и потребностью', () => {
    const ics = buildPracticeIcs({
      text: 'Погулять',
      needLabel: 'Автономия',
      localHour: 13,
      tzOffset: 3,
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Погулять');
    expect(ics).toContain('DESCRIPTION:Практика для потребности: Автономия');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('пересчитывает локальный час в UTC по смещению часового пояса', () => {
    // 13:00 локально при UTC+3 → 10:00 UTC.
    const ics = buildPracticeIcs({
      text: 'x',
      needLabel: 'y',
      localHour: 13,
      tzOffset: 3,
    });
    expect(ics).toMatch(/DTSTART:\d{8}T100000Z/);
    expect(ics).toMatch(/DTEND:\d{8}T103000Z/);
  });

  it('отрицательное/переходящее через полночь смещение не даёт отрицательный час', () => {
    // 1:00 локально при UTC+3 → -2 → должно завернуться в 22:00 UTC.
    const ics = buildPracticeIcs({
      text: 'x',
      needLabel: 'y',
      localHour: 1,
      tzOffset: 3,
    });
    expect(ics).toMatch(/DTSTART:\d{8}T220000Z/);
  });

  it('localHour=null — дефолт 09:00 местного (без выбранного времени)', () => {
    const ics = buildPracticeIcs({
      text: 'x',
      needLabel: 'y',
      localHour: null,
      tzOffset: 3,
    });
    expect(ics).toMatch(/DTSTART:\d{8}T060000Z/);
  });

  // U5: календарь — единственное напоминание у тех, кому не доходит Telegram.
  it('событие несёт сигнал в момент начала (VALARM), иначе календарь молчит', () => {
    const ics = buildPracticeIcs({
      text: 'Погулять',
      needLabel: 'y',
      localHour: 9,
      tzOffset: 3,
    });
    expect(ics).toMatch(
      /BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Погулять\r\nTRIGGER:PT0M\r\nEND:VALARM\r\nEND:VEVENT/,
    );
  });
});

// «Завтра» — по местному дню человека, а не по дню UTC устройства (правило №25).
describe('buildPracticeIcs — день события', () => {
  afterEach(() => vi.useRealTimers());

  it('Москва, 01:30 9 ноября: событие на 10 ноября, а не на сегодня', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-08T22:30:00Z'));
    const ics = buildPracticeIcs({
      text: 'x',
      needLabel: 'y',
      localHour: 9,
      tzOffset: 3,
    });
    expect(ics).toContain('DTSTART:20261110T060000Z');
  });

  it('Сидней, 20:00 8 ноября: событие на 9 ноября 09:00, а не на послезавтра', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-08T09:00:00Z'));
    const ics = buildPracticeIcs({
      text: 'x',
      needLabel: 'y',
      localHour: 9,
      tzOffset: 11,
    });
    expect(ics).toContain('DTSTART:20261108T220000Z');
    expect(ics).toContain('DTEND:20261108T223000Z');
  });

  it('planEventStartMs — тот же момент для ссылки Google Календаря', () => {
    const now = new Date('2026-11-08T09:00:00Z');
    expect(new Date(planEventStartMs(19, -5, now)).toISOString()).toBe(
      '2026-11-10T00:00:00.000Z',
    );
    expect(new Date(planEventStartMs(null, 0, now)).toISOString()).toBe(
      '2026-11-09T09:00:00.000Z',
    );
  });
});

describe('practiceIcsDataUrl', () => {
  it('оборачивает ics-текст в data: URL с правильным MIME', () => {
    const url = practiceIcsDataUrl({
      text: 'Погулять',
      needLabel: 'Автономия',
      localHour: 9,
      tzOffset: 3,
    });
    expect(url.startsWith('data:text/calendar;charset=utf-8,')).toBe(true);
    expect(
      decodeURIComponent(url.slice('data:text/calendar;charset=utf-8,'.length)),
    ).toContain('SUMMARY:Погулять');
  });
});
