// Чистая утилита сборки ICS (RFC 5545). Покрываем экранирование, форматы
// дат/времени и округление длительности — это ЕДИНСТВЕННОЕ место, откуда
// событие уходит в Apple Calendar; ошибка здесь молча портит календарь
// терапевта (не деньги напрямую, но пропущенная/сдвинутая сессия).
import { SessionType } from '@prisma/client';
import { buildVcalendar, CalEvent, sessionLabel } from './caldav-event.util';

const BASE: CalEvent = {
  uid: 'evt-1@schemehappens.ru',
  startsAt: new Date('2026-07-13T10:00:00.000Z'),
  durationMin: 50,
  summary: 'Сессия — Мария',
};

describe('buildVcalendar — структура и CRLF', () => {
  it('оборачивает в BEGIN/END:VCALENDAR с CRLF-разделителями (RFC 5545)', () => {
    const ics = buildVcalendar([BASE]);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0\r\n');
    expect(ics).toContain('PRODID:-//schemehappens//booking//RU\r\n');
    // Ни одного голого \n без предшествующего \r внутри тела.
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('X-WR-CALNAME использует переданное имя календаря или дефолт', () => {
    expect(buildVcalendar([BASE])).toContain(
      'X-WR-CALNAME:Запись на сессии\r\n',
    );
    expect(buildVcalendar([BASE], 'Мой календарь')).toContain(
      'X-WR-CALNAME:Мой календарь\r\n',
    );
  });

  it('пустой список событий — валидный VCALENDAR без единого VEVENT', () => {
    const ics = buildVcalendar([]);
    expect(ics).not.toContain('BEGIN:VEVENT');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('несколько событий — каждое в своём BEGIN/END:VEVENT, порядок сохранён', () => {
    const ev2: CalEvent = { ...BASE, uid: 'evt-2@schemehappens.ru' };
    const ics = buildVcalendar([BASE, ev2]);
    const uids = [...ics.matchAll(/UID:([^\r\n]+)/g)].map((m) => m[1]);
    expect(uids).toEqual(['evt-1@schemehappens.ru', 'evt-2@schemehappens.ru']);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect((ics.match(/END:VEVENT/g) ?? []).length).toBe(2);
  });
});

describe('buildVevent — обязательные и опциональные поля', () => {
  it('DTSTART/DTEND в формате YYYYMMDDTHHMMSSZ, DTEND = DTSTART + durationMin', () => {
    const ics = buildVcalendar([BASE]);
    expect(ics).toContain('DTSTART:20260713T100000Z\r\n');
    expect(ics).toContain('DTEND:20260713T105000Z\r\n'); // +50 мин
  });

  it('DTSTAMP присутствует и тоже в UTC-формате (Z)', () => {
    const ics = buildVcalendar([BASE]);
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
  });

  it('нулевая длительность — DTEND совпадает с DTSTART', () => {
    const ics = buildVcalendar([{ ...BASE, durationMin: 0 }]);
    expect(ics).toContain('DTSTART:20260713T100000Z\r\n');
    expect(ics).toContain('DTEND:20260713T100000Z\r\n');
  });

  it('длительность, переходящая через сутки, корректно переносит дату', () => {
    const late = { ...BASE, startsAt: new Date('2026-07-13T23:40:00.000Z') };
    const ics = buildVcalendar([late]);
    expect(ics).toContain('DTSTART:20260713T234000Z\r\n');
    expect(ics).toContain('DTEND:20260714T003000Z\r\n'); // +50 мин, следующий день
  });

  it('опциональные DESCRIPTION/LOCATION/ORGANIZER отсутствуют, если не заданы', () => {
    const ics = buildVcalendar([BASE]);
    expect(ics).not.toContain('DESCRIPTION:');
    expect(ics).not.toContain('LOCATION:');
    expect(ics).not.toContain('ORGANIZER:');
  });

  it('опциональные поля включаются, если заданы; ORGANIZER — как mailto:', () => {
    const ev: CalEvent = {
      ...BASE,
      description: 'Zoom-ссылка внутри',
      location: 'https://meet.jit.si/room',
      organizerEmail: 'therapist@schemehappens.ru',
    };
    const ics = buildVcalendar([ev]);
    expect(ics).toContain('DESCRIPTION:Zoom-ссылка внутри\r\n');
    expect(ics).toContain('LOCATION:https://meet.jit.si/room\r\n');
    expect(ics).toContain('ORGANIZER:mailto:therapist@schemehappens.ru\r\n');
  });

  it('SUMMARY передаёт кириллицу и эмодзи без потерь', () => {
    const ics = buildVcalendar([{ ...BASE, summary: 'Сессия 🧠 — тест' }]);
    expect(ics).toContain('SUMMARY:Сессия 🧠 — тест\r\n');
  });
});

describe('escapeText — экранирование по RFC 5545', () => {
  const escapedSummaryLine = (summary: string) => {
    const ics = buildVcalendar([{ ...BASE, summary }]);
    const m = ics.match(/SUMMARY:([^\r\n]*)\r\n/);
    return m ? m[1] : null;
  };

  it('обратный слэш экранируется первым (до других замен)', () => {
    expect(escapedSummaryLine('back\\slash')).toBe('back\\\\slash');
  });

  it('точка с запятой экранируется', () => {
    expect(escapedSummaryLine('a;b')).toBe('a\\;b');
  });

  it('запятая экранируется', () => {
    expect(escapedSummaryLine('a,b')).toBe('a\\,b');
  });

  it('перевод строки превращается в литеральный \\n', () => {
    expect(escapedSummaryLine('line1\nline2')).toBe('line1\\nline2');
  });

  it('комбинация спецсимволов — все экранируются одновременно, без двойного экранирования', () => {
    expect(escapedSummaryLine('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });

  it('обычный текст без спецсимволов не меняется', () => {
    expect(escapedSummaryLine('Обычный текст 123')).toBe('Обычный текст 123');
  });
});

describe('sessionLabel', () => {
  it('INTRO_15 → «Знакомство (15 мин)»', () => {
    expect(sessionLabel(SessionType.INTRO_15)).toBe('Знакомство (15 мин)');
  });

  it('SESSION_50 → «Сессия (50 мин)»', () => {
    expect(sessionLabel(SessionType.SESSION_50)).toBe('Сессия (50 мин)');
  });
});
