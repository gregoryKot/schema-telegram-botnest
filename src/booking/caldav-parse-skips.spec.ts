// Fail-open разбора занятости больше не немой (docs/open/backend.md, «Fail-open
// парсера немой»): parseBusy по-прежнему не роняет календарь из-за одного
// кривого события, но считает, сколько VEVENT не понял, — счёт уходит в детали
// пробы самопроверки caldav и в блок «Личный календарь» /stats.
import { parseBusy } from './caldav-busy';
import {
  busySkips,
  formatSkips,
  noSkips,
  sumSkips,
} from './caldav-parse-skips';

const vevent = (lines: string) => `BEGIN:VEVENT\n${lines}\nEND:VEVENT`;
const xmlOf = (...events: string[]) =>
  `<c:calendar-data>BEGIN:VCALENDAR\n${events.join('\n')}\nEND:VCALENDAR</c:calendar-data>`;

beforeEach(() => busySkips.reset());

describe('parseBusy — счёт пропущенных VEVENT', () => {
  it('всё разобрано — счёт нулевой, интервалы те же', () => {
    const skipped = noSkips();
    const out = parseBusy(
      xmlOf(vevent('DTSTART:20261017T100000Z\nDTEND:20261017T110000Z')),
      skipped,
    );
    expect(out).toHaveLength(1);
    expect(skipped).toEqual({ recurring: 0, badStart: 0, badEnd: 0 });
  });

  it('RRULE-мастер, кривой и пропавший DTSTART, кривой DTEND — каждый в своём счёте', () => {
    const skipped = noSkips();
    const out = parseBusy(
      xmlOf(
        vevent('DTSTART:20261017T100000Z\nRRULE:FREQ=WEEKLY'),
        vevent('DTSTART;X=1:20261017T100000Z\nRRULE;X=Y:FREQ=DAILY'),
        vevent('DTSTART:2026-10-17 10:00'),
        vevent('SUMMARY:без начала'),
        vevent('DTSTART:20261017T120000Z\nDTEND:завтра'),
        vevent('DTSTART:20261017T140000Z\nDTEND:20261017T150000Z'),
      ),
      skipped,
    );
    expect(skipped).toEqual({ recurring: 2, badStart: 2, badEnd: 1 });
    // Кривой DTEND не теряет событие: час от начала (fail-closed), как и раньше.
    expect(out.map((i) => i.end.toISOString())).toEqual([
      '2026-10-17T13:00:00.000Z',
      '2026-10-17T15:00:00.000Z',
    ]);
  });

  it('счётчик копится по нескольким календарям (один объект на чтение)', () => {
    const skipped = noSkips();
    parseBusy(xmlOf(vevent('SUMMARY:x')), skipped);
    parseBusy(
      xmlOf(vevent('DTSTART:20261017T100000Z\nRRULE:FREQ=DAILY')),
      skipped,
    );
    expect(skipped).toEqual({ recurring: 1, badStart: 1, badEnd: 0 });
  });

  it('без счётчика parseBusy работает как раньше', () => {
    expect(parseBusy(xmlOf(vevent('SUMMARY:x')))).toEqual([]);
  });
});

describe('caldav-parse-skips — сумма, хранение, текст для владельца', () => {
  it('sumSkips складывает по полям, упавшее чтение без счёта — ноль', () => {
    expect(
      sumSkips([
        { ok: true, skipped: { recurring: 1, badStart: 0, badEnd: 2 } },
        { ok: false },
        { ok: true, skipped: { recurring: 0, badStart: 3, badEnd: 1 } },
      ]),
    ).toEqual({ recurring: 1, badStart: 3, badEnd: 3 });
  });

  it('busySkips хранит копию последнего чтения; reset — назад к «не читали»', () => {
    const s = { recurring: 1, badStart: 0, badEnd: 0 };
    busySkips.note(s);
    s.recurring = 9;
    expect(busySkips.last()).toEqual({ recurring: 1, badStart: 0, badEnd: 0 });
    busySkips.reset();
    expect(busySkips.last()).toBeNull();
  });

  it('formatSkips: не читали или всё разобрано — null', () => {
    expect(formatSkips(null)).toBeNull();
    expect(formatSkips(noSkips())).toBeNull();
  });

  it('formatSkips: называет всего и только ненулевые причины', () => {
    const text = formatSkips({ recurring: 2, badStart: 0, badEnd: 1 });
    expect(text).toBe(
      'при последнем чтении занятости не разобрано событий: 3 ' +
        '(повторяющихся без разворота — 2, с непонятным концом — 1); ' +
        'их часы могут остаться открытыми для записи',
    );
  });
});
