// Парсинг busy-интервалов из CalDAV multistatus XML. Это единственный барьер
// против двойной записи через внешний календарь: если тут пропустить
// событие или неверно распарсить дату, слот покажется свободным, хотя
// терапевт уже занят. Покрываем максимально исчерпывающе.
import { busyQueryXml, parseBusy } from './caldav-busy';
import { overlapsInterval } from './slot-filters';

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

// Регрессия (инцидент 2026-07-20): localToUtc переводил стенное время через
// `new Date(naive.toLocaleString('en-US', { timeZone: tz }))`. Строка без зоны
// парсилась обратно в ЛОКАЛЬНОЙ зоне процесса, поэтому в смещение подмешивалось
// смещение сервера. Под TZ=UTC совпадало случайно (смещение процесса = 0), а на
// любой другой зоне смещение TZID терялось целиком: Москва и Нью-Йорк давали
// ОДНО И ТО ЖЕ время. На проде в не-UTC зоне это значит, что busy-интервал
// уезжает и слот показывается свободным, хотя терапевт занят.
//
// ВАЖНО про то, почему тут нет цикла по process.env.TZ: внутри jest мутация
// `process.env.TZ` НЕ влияет на Date — песочница не пробрасывает смену зоны в
// V8, все итерации молча дают один и тот же результат. Такой цикл зелёный и на
// сломанном парсере, то есть бесполезен. Настоящий барьер — джоба CI
// «jest под не-UTC таймзоной» (.github/workflows/ci.yml), которая гоняет весь
// пакет с TZ=Australia/Sydney. Проверки ниже — точные значения смещений; они
// краснеют на старом парсере в любой не-UTC зоне.
describe('parseBusy — смещение TZID считается от зоны события, не от зоны сервера', () => {
  it('Москва и Нью-Йорк с одинаковым стенным временем НЕ схлопываются в одно UTC', () => {
    const msk = parseBusy(
      multistatus([vevent('DTSTART;TZID=Europe/Moscow:20260713T170000')]),
    );
    const nyc = parseBusy(
      multistatus([vevent('DTSTART;TZID=America/New_York:20260713T170000')]),
    );
    // 17:00 MSK (+3) = 14:00Z, 17:00 EDT (−4) = 21:00Z — ровно 7 часов разницы
    expect(msk[0].start.toISOString()).toBe('2026-07-13T14:00:00.000Z');
    expect(nyc[0].start.toISOString()).toBe('2026-07-13T21:00:00.000Z');
  });

  it('переход на летнее время: смещение берётся на момент события, не «сегодняшнее»', () => {
    // В Нью-Йорке 2026-03-08 часы переводят вперёд: EST (−5) → EDT (−4).
    const before = parseBusy(
      multistatus([vevent('DTSTART;TZID=America/New_York:20260301T120000')]),
    );
    const after = parseBusy(
      multistatus([vevent('DTSTART;TZID=America/New_York:20260401T120000')]),
    );
    expect(before[0].start.toISOString()).toBe('2026-03-01T17:00:00.000Z'); // EST
    expect(after[0].start.toISOString()).toBe('2026-04-01T16:00:00.000Z'); // EDT
  });

  it('зона с получасовым смещением (Asia/Kolkata, +5:30) считается точно', () => {
    const out = parseBusy(
      multistatus([vevent('DTSTART;TZID=Asia/Kolkata:20260713T173000')]),
    );
    expect(out[0].start.toISOString()).toBe('2026-07-13T12:00:00.000Z');
  });

  it('нестандартный TZID (Outlook) не роняет разбор остальных событий', () => {
    // Intl бросает RangeError на «Russian Standard Time». Раньше исключение
    // всплывало из parseBusy, и вызывающий (caldav.service) ловил его своим
    // catch — теряя busy-список ВСЕГО календаря, то есть все слоты
    // показывались свободными из-за одного кривого ивента.
    const out = parseBusy(
      multistatus([
        vevent('DTSTART;TZID=Russian Standard Time:20260713T170000'),
        vevent('DTSTART:20260714T170000Z'),
      ]),
    );
    expect(out).toHaveLength(2);
    // Неизвестная зона деградирует до floating (UTC), а не выбрасывает
    expect(out[0].start.toISOString()).toBe('2026-07-13T17:00:00.000Z');
    expect(out[1].start.toISOString()).toBe('2026-07-14T17:00:00.000Z');
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

describe('parseBusy — SUMMARY события (только для отображения владельцу, см. admin-calendar.ts)', () => {
  it('VEVENT с SUMMARY — у интервала есть раз-экранированное поле summary', () => {
    const xml = multistatus([
      vevent(
        'DTSTART:20260713T170000Z\nDTEND:20260713T175000Z\nSUMMARY:Встреча с клиентом',
      ),
    ]);
    const out = parseBusy(xml);
    expect(out).toHaveLength(1);
    expect(out[0].summary).toBe('Встреча с клиентом');
  });

  it('VEVENT без SUMMARY — поле summary отсутствует, а не пустая строка', () => {
    const xml = multistatus([
      vevent('DTSTART:20260713T170000Z\nDTEND:20260713T175000Z'),
    ]);
    const out = parseBusy(xml);
    expect(out).toHaveLength(1);
    expect(out[0].summary).toBeUndefined();
    expect('summary' in out[0]).toBe(false);
    // Старый ассерт (до summary) остаётся зелёным: toEqual игнорирует
    // отсутствующий ключ — регресс для существующих потребителей исключён.
    expect(out[0]).toEqual({
      start: new Date('2026-07-13T17:00:00.000Z'),
      end: new Date('2026-07-13T17:50:00.000Z'),
    });
  });
});

// Находка аудита 2026-10-11: событие «весь день» без DTEND (и любое событие с
// DURATION) закрывало один час с начала — выходной владельца оставался открыт
// 9 слотов из 9. Спек раньше пинил только start, поэтому дыра была невидима.
// Ожидаемые значения — точные ISO, от зоны процесса не зависят (во второй
// CI-джобе гоняется под TZ=Australia/Sydney).
describe('parseBusy — конец события по RFC 5545 §3.6.1', () => {
  const endOf = (lines: string): string | undefined =>
    parseBusy(multistatus([vevent(lines)]))[0]?.end.toISOString();

  it.each([
    [
      'DATE без DTEND — сутки',
      'DTSTART;VALUE=DATE:20261017',
      '2026-10-18T00:00:00.000Z',
    ],
    [
      'DATE + DURATION:P1D',
      'DTSTART;VALUE=DATE:20261017\nDURATION:P1D',
      '2026-10-18T00:00:00.000Z',
    ],
    [
      'DATE + DURATION:P2D',
      'DTSTART;VALUE=DATE:20261017\nDURATION:P2D',
      '2026-10-19T00:00:00.000Z',
    ],
    [
      'DATE + DURATION:P1W',
      'DTSTART;VALUE=DATE:20261017\nDURATION:P1W',
      '2026-10-24T00:00:00.000Z',
    ],
    [
      'UTC + DURATION:PT2H',
      'DTSTART:20261017T100000Z\nDURATION:PT2H',
      '2026-10-17T12:00:00.000Z',
    ],
    [
      'UTC + DURATION:PT1H30M',
      'DTSTART:20261017T100000Z\nDURATION:PT1H30M',
      '2026-10-17T11:30:00.000Z',
    ],
    [
      'UTC + DURATION:PT45S',
      'DTSTART:20261017T100000Z\nDURATION:PT45S',
      '2026-10-17T10:00:45.000Z',
    ],
    [
      'UTC + DURATION:P1DT2H',
      'DTSTART:20261017T100000Z\nDURATION:P1DT2H',
      '2026-10-18T12:00:00.000Z',
    ],
    [
      'знак + допустим',
      'DTSTART:20261017T100000Z\nDURATION:+PT2H',
      '2026-10-17T12:00:00.000Z',
    ],
    [
      'DURATION с параметрами',
      'DTSTART:20261017T100000Z\nDURATION;X-A=b:PT2H',
      '2026-10-17T12:00:00.000Z',
    ],
    [
      'TZID: длительность прибавляется к уже переведённому start',
      'DTSTART;TZID=Europe/Moscow:20261017T100000\nDURATION:PT50M',
      '2026-10-17T07:50:00.000Z',
    ],
  ])('%s', (_name, lines, end) => {
    expect(endOf(lines)).toBe(end);
  });

  it('TZID + DURATION: start тоже в UTC, интервал ровно 50 минут', () => {
    const [iv] = parseBusy(
      multistatus([
        vevent('DTSTART;TZID=Europe/Moscow:20261017T100000\nDURATION:PT50M'),
      ]),
    );
    expect(iv.start.toISOString()).toBe('2026-10-17T07:00:00.000Z');
    expect(iv.end.getTime() - iv.start.getTime()).toBe(50 * 60_000);
  });

  it('DTEND сильнее DURATION, если по ошибке пришли оба', () => {
    expect(
      endOf('DTSTART:20261017T100000Z\nDTEND:20261017T103000Z\nDURATION:PT5H'),
    ).toBe('2026-10-17T10:30:00.000Z');
  });

  it.each([
    ['abc', 'DTSTART:20261017T100000Z', '2026-10-17T11:00:00.000Z'],
    ['-PT1H', 'DTSTART:20261017T100000Z', '2026-10-17T11:00:00.000Z'],
    ['PT0S', 'DTSTART:20261017T100000Z', '2026-10-17T11:00:00.000Z'],
    ['P', 'DTSTART:20261017T100000Z', '2026-10-17T11:00:00.000Z'],
    ['abc', 'DTSTART;VALUE=DATE:20261017', '2026-10-18T00:00:00.000Z'],
    ['-P1D', 'DTSTART;VALUE=DATE:20261017', '2026-10-18T00:00:00.000Z'],
  ])(
    'мусорный DURATION:%s у %s — откат к умолчанию, событие не теряется',
    (dur, start, end) => {
      expect(endOf(`${start}\nDURATION:${dur}`)).toBe(end);
    },
  );

  it('мусорный DURATION не ломает соседние события', () => {
    const out = parseBusy(
      multistatus([
        vevent('DTSTART:20261017T100000Z\nDURATION:abc'),
        vevent('DTSTART:20261017T120000Z\nDURATION:PT2H'),
      ]),
    );
    expect(out.map((i) => i.end.toISOString())).toEqual([
      '2026-10-17T11:00:00.000Z',
      '2026-10-17T14:00:00.000Z',
    ]);
  });

  it('DURATION, перенесённый CRLF + пробел (unfolding), читается целиком', () => {
    const xml = `<c>BEGIN:VEVENT\r\nDTSTART:20261017T100000Z\r\nDURATION:PT\r\n 2H\r\nEND:VEVENT</c>`;
    expect(parseBusy(xml)[0].end.toISOString()).toBe(
      '2026-10-17T12:00:00.000Z',
    );
  });

  it('DTSTART-дата в середине файла не путается с DTSTART другого поля', () => {
    // X-DTSTART-подобные строки не должны считаться началом «на весь день».
    expect(endOf('DTSTART:20261017T100000Z\nX-DTSTART:20261017')).toBe(
      '2026-10-17T11:00:00.000Z',
    );
  });
});

// Шов (правило №14): парсер → фильтр слотов, как в slot.service. В
// caldav.service.spec.ts parseBusy замокан и этот стык не виден.
describe('parseBusy → overlapsInterval — выходной владельца закрыт целиком', () => {
  const slotsOfDay = (): { start: Date; end: Date }[] =>
    Array.from({ length: 9 }, (_, i) => {
      const start = new Date(Date.UTC(2026, 9, 17, 9 + i));
      return { start, end: new Date(start.getTime() + 50 * 60_000) };
    });

  it.each([
    ['без DTEND', 'DTSTART;VALUE=DATE:20261017'],
    ['с DURATION:P1D', 'DTSTART;VALUE=DATE:20261017\nDURATION:P1D'],
    ['с DTEND', 'DTSTART;VALUE=DATE:20261017\nDTEND;VALUE=DATE:20261018'],
  ])('событие на весь день %s: свободных слотов 0 из 9', (_n, lines) => {
    const busy = parseBusy(multistatus([vevent(lines)]));
    const free = slotsOfDay().filter(
      (s) => !overlapsInterval(s.start, s.end, busy),
    );
    expect(free).toHaveLength(0);
  });

  it('соседний день событием не закрывается', () => {
    const busy = parseBusy(
      multistatus([vevent('DTSTART;VALUE=DATE:20261016')]),
    );
    const free = slotsOfDay().filter(
      (s) => !overlapsInterval(s.start, s.end, busy),
    );
    expect(free).toHaveLength(9);
  });
});
