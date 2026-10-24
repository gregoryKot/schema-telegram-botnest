import { describe, it, expect } from 'vitest';
import { buildGoogleCalendarUrl } from './googleCalendarLink';

describe('buildGoogleCalendarUrl', () => {
  it('dates — UTC с суффиксом Z, конец = начало + durationMin', () => {
    const url = buildGoogleCalendarUrl({
      title: 'Встреча',
      startsAt: '2026-08-10T10:00:00.000Z',
      durationMin: 50,
      details: 'подробности',
    });
    const params = new URL(url).searchParams;
    expect(params.get('dates')).toBe('20260810T100000Z/20260810T105000Z');
  });

  it('action=TEMPLATE — базовый параметр Google Calendar', () => {
    const url = buildGoogleCalendarUrl({
      title: 'X', startsAt: '2026-08-10T10:00:00.000Z', durationMin: 15, details: '',
    });
    expect(new URL(url).searchParams.get('action')).toBe('TEMPLATE');
  });

  it('текст и детали кодируются, спецсимволы не ломают URL', () => {
    const url = buildGoogleCalendarUrl({
      title: 'Встреча & подтверждение?',
      startsAt: '2026-08-10T10:00:00.000Z',
      durationMin: 15,
      details: 'https://example.com?token=a&b=1\nвторая строка',
    });
    const params = new URL(url).searchParams;
    expect(params.get('text')).toBe('Встреча & подтверждение?');
    expect(params.get('details')).toBe('https://example.com?token=a&b=1\nвторая строка');
    expect(url).not.toContain('\n'); // сырой перевод строки не попадает в URL как есть
  });

  it('часовой пояс исходной строки не влияет на UTC-результат', () => {
    // +07:00 → на 7 часов раньше в UTC
    const url = buildGoogleCalendarUrl({
      title: 'X', startsAt: '2026-08-10T17:00:00.000+07:00', durationMin: 30, details: '',
    });
    expect(new URL(url).searchParams.get('dates')).toBe('20260810T100000Z/20260810T103000Z');
  });

  it('нулевая длительность — начало и конец совпадают', () => {
    const url = buildGoogleCalendarUrl({
      title: 'X', startsAt: '2026-08-10T10:00:00.000Z', durationMin: 0, details: '',
    });
    expect(new URL(url).searchParams.get('dates')).toBe('20260810T100000Z/20260810T100000Z');
  });
});
