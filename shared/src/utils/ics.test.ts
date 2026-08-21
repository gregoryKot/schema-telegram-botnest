// buildPracticeIcs/practiceIcsDataUrl — чистая генерация .ics для PlanSheet,
// общая для webapp и мини-аппа (правило №3, паритет фич правило №16).
import { describe, it, expect } from 'vitest';
import { buildPracticeIcs, practiceIcsDataUrl } from './ics';

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

  it('localHour=null — дефолт 09:00 UTC (без выбранного времени)', () => {
    const ics = buildPracticeIcs({
      text: 'x',
      needLabel: 'y',
      localHour: null,
      tzOffset: 3,
    });
    expect(ics).toMatch(/DTSTART:\d{8}T090000Z/);
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
