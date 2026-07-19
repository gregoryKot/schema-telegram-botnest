// Парсинг busy-интервалов из CalDAV multistatus XML. Это единственный барьер
// против двойной записи через внешний календарь: если тут пропустить
// событие или неверно распарсить дату, слот покажется свободным, хотя
// терапевт уже занят. Покрываем максимально исчерпывающе.
import { busyQueryXml, parseBusy } from './caldav-busy';

describe('busyQueryXml', () => {
  it('содержит c:time-range с UTC-таймстемпами формата YYYYMMDDTHHMMSSZ', () => {
    const xml = busyQueryXml(
      new Date('2026-07-13T00:00:00Z'),
      new Date('2026-07-14T00:00:00Z'),
    );
    expect(xml).toContain(
      '<c:time-range start="20260713T000000Z" end="20260714T000000Z"/>',
    );
  });

  it('запрашивает c:expand для разворачивания повторяющихся событий', () => {
    const xml = busyQueryXml(new Date(), new Date());
    expect(xml).toContain('<c:expand');
  });

  it('валидный XML-фрагмент: сбалансированные VCALENDAR/VEVENT теги запроса', () => {
    const xml = busyQueryXml(new Date(), new Date());
    expect(xml).toContain('<c:calendar-query');
    expect(xml).toContain('</c:calendar-query>');
  });
});

function vevent(lines: string): string {
  return `BEGIN:VEVENT\n${lines}\nEND:VEVENT`;
}

function multistatus(events: string[]): string {
  return `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop><c:calendar-data>BEGIN:VCALENDAR\n${events.join('\n')}\nEND:VCALENDAR</c:calendar-data></d:prop></d:propstat></d:response></d:multistatus>`;
}

describe('parseBusy — базовые форматы дат', () => {
  it('UTC-время (Z) — DTSTART/DTEND распознаются точно', () => {
    const xml = multistatus([
      vevent('DTSTART:20260713T170000Z\nDTEND:20260713T175000Z'),
    ]);
    const out = parseBusy(xml);
    expect(out).toHaveLength(1);
    expect(out[0].start.toISOString()).toBe('2026-07-13T17:00:00.000Z');
    expect(out[0].end.toISOString()).toBe('2026-07-13T17:50:00.000Z');
  });

  it('нет DTEND — по умолчанию 1 час от DTSTART', () => {
    const xml = multistatus([vevent('DTSTART:20260713T170000Z')]);
    const out = parseBusy(xml);
    expect(out).toHaveLength(1);
    expect(out[0].end.toISOString()).toBe('2026-07-13T18:00:00.000Z');
  });

  it('нет DTSTART вовсе — событие полностью пропускается', () => {
    const xml = multistatus([vevent('SUMMARY:без даты начала')]);
    expect(parseBusy(xml)).toHaveLength(0);
  });

  it('DTSTART не матчит формат (мусор) — событие пропускается, остальные парсятся', () => {
    const xml = multistatus([
      vevent('DTSTART:not-a-date'),
      vevent('DTSTART:20260713T170000Z'),
    ]);
    const out = parseBusy(xml);
    expect(out).toHaveLength(1);
    expect(out[0].start.toISOString()).toBe('2026-07-13T17:00:00.000Z');
  });
});

describe('parseBusy — весь день (VALUE=DATE)', () => {
  it('DTSTART;VALUE=DATE — трактуется как полночь UTC того дня', () => {
    const xml = multistatus([vevent('DTSTART;VALUE=DATE:20260713')]);
    const out = parseBusy(xml);
    expect(out[0].start.toISOString()).toBe('2026-07-13T00:00:00.000Z');
  });

  it('DTSTART и DTEND оба VALUE=DATE — интервал от полуночи до полуночи следующего дня', () => {
    const xml = multistatus([
      vevent('DTSTART;VALUE=DATE:20260713\nDTEND;VALUE=DATE:20260714'),
    ]);
    const out = parseBusy(xml);
    expect(out[0].start.toISOString()).toBe('2026-07-13T00:00:00.000Z');
    expect(out[0].end.toISOString()).toBe('2026-07-14T00:00:00.000Z');
  });
});

describe('parseBusy — таймзоны (TZID) и floating time', () => {
  it('TZID=Europe/Moscow — конвертируется в UTC с учётом смещения (+3)', () => {
    const xml = multistatus([
      vevent('DTSTART;TZID=Europe/Moscow:20260713T170000'),
    ]);
    const out = parseBusy(xml);
    expect(out[0].start.toISOString()).toBe('2026-07-13T14:00:00.000Z');
  });

  it('TZID=America/New_York — не смешивается со смещением Москвы (другой офсет)', () => {
    const xml = multistatus([
      vevent('DTSTART;TZID=America/New_York:20260713T100000'),
    ]);
    const out = parseBusy(xml);
    // EDT (UTC-4) в июле
    expect(out[0].start.toISOString()).toBe('2026-07-13T14:00:00.000Z');
  });

  it('floating time без TZID и без Z — считается UTC (best effort)', () => {
    const xml = multistatus([vevent('DTSTART:20260713T170000')]);
    const out = parseBusy(xml);
    expect(out[0].start.toISOString()).toBe('2026-07-13T17:00:00.000Z');
  });
});

describe('parseBusy — повторяющиеся события (RRULE) пропускаются (MVP)', () => {
  it('RRULE внутри VEVENT — событие целиком исключается из busy-списка', () => {
    const xml = multistatus([
      vevent('DTSTART:20260713T170000Z\nRRULE:FREQ=WEEKLY'),
      vevent('DTSTART:20260714T170000Z'),
    ]);
    const out = parseBusy(xml);
    expect(out).toHaveLength(1);
    expect(out[0].start.toISOString()).toBe('2026-07-14T17:00:00.000Z');
  });

  it('RRULE с параметрами (RRULE;X=Y:...) тоже распознаётся как повторяющееся', () => {
    const xml = multistatus([
      vevent('DTSTART:20260713T170000Z\nRRULE;X=Y:FREQ=DAILY'),
    ]);
    expect(parseBusy(xml)).toHaveLength(0);
  });
});

describe('parseBusy — построчный unfolding (RFC 5545 line continuation)', () => {
  it('DTSTART, перенесённый на следующую строку с ведущим пробелом (CRLF+space), склеивается перед парсингом', () => {
    const xml = multistatus([
      `BEGIN:VEVENT\r\nDTSTART:2026071\r\n 3T170000Z\r\nEND:VEVENT`,
    ]);
    const out = parseBusy(xml);
    expect(out).toHaveLength(1);
    expect(out[0].start.toISOString()).toBe('2026-07-13T17:00:00.000Z');
  });
});

describe('parseBusy — несколько событий и общая устойчивость', () => {
  it('несколько нормальных VEVENT в одном multistatus — все возвращаются', () => {
    const xml = multistatus([
      vevent('DTSTART:20260713T170000Z\nDTEND:20260713T175000Z'),
      vevent('DTSTART:20260714T090000Z\nDTEND:20260714T093000Z'),
    ]);
    expect(parseBusy(xml)).toHaveLength(2);
  });

  it('пустой/мусорный XML — возвращает пустой массив, не бросает исключение', () => {
    expect(parseBusy('')).toEqual([]);
    expect(parseBusy('<not-even-xml>')).toEqual([]);
  });

  it('нет ни одного VEVENT-блока — пустой результат', () => {
    expect(parseBusy('<d:multistatus></d:multistatus>')).toEqual([]);
  });
});
