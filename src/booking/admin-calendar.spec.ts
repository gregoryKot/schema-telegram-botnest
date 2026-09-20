// Сердце контракта «Календарь слотов в админке» — buildAdminCalendar чистая,
// без единого похода в БД, поэтому тестируется без моков. timezone: 'UTC' в
// фикстурах — упрощает арифметику часов в assert'ах (сама зона проверяется
// отдельно в rule-expand.spec.ts/availability-window.spec.ts).
import {
  buildAdminCalendar,
  AdminCalendarRuleInput,
  AdminCalendarOverrideInput,
  AdminCalendarBookingInput,
} from './admin-calendar';

const MON_RULE: AdminCalendarRuleInput = {
  dayOfWeek: 1, // понедельник
  startHour: 9,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  sessionDuration: 50,
  bufferMin: 10,
  timezone: 'UTC',
};
const MONDAY = '2026-07-13';
// now далеко ДО диапазона — earliest = now+12ч не задевает ни одну ячейку
// понедельника, past=false везде, кроме выделенного теста на past.
const FAR_PAST_NOW = new Date('2026-07-01T00:00:00Z');

function cellAt(
  days: ReturnType<typeof buildAdminCalendar>,
  date: string,
  iso: string,
) {
  return days
    .find((d) => d.date === date)
    ?.cells.find((c) => c.startsAt === iso);
}

function base(
  overrides: Partial<Parameters<typeof buildAdminCalendar>[0]> = {},
) {
  return buildAdminCalendar({
    from: MONDAY,
    to: MONDAY,
    timezone: 'UTC',
    rules: [MON_RULE],
    overrides: [],
    bookings: [],
    busy: [],
    calendarBlocking: false,
    now: FAR_PAST_NOW,
    ...overrides,
  });
}

describe('buildAdminCalendar — занятость календаря (busy) и calendarBlocking', () => {
  const busy = [
    {
      start: new Date('2026-07-13T12:00:00Z'),
      end: new Date('2026-07-13T13:00:00Z'),
    },
  ];

  it('calendarBlocking=true: занятая ячейка 12:00 → busy, соседние 11:00/13:00 остаются free', () => {
    const days = base({ busy, calendarBlocking: true });
    expect(cellAt(days, MONDAY, '2026-07-13T12:00:00.000Z')?.state).toBe(
      'busy',
    );
    expect(cellAt(days, MONDAY, '2026-07-13T11:00:00.000Z')?.state).toBe(
      'free',
    );
    expect(cellAt(days, MONDAY, '2026-07-13T13:00:00.000Z')?.state).toBe(
      'free',
    );
  });

  it('calendarBlocking=false: та же встреча не меняет state, но busy-флаг остаётся видимым', () => {
    const days = base({ busy, calendarBlocking: false });
    const cell = cellAt(days, MONDAY, '2026-07-13T12:00:00.000Z');
    expect(cell?.state).toBe('free');
    expect(cell?.busy).toBe(true);
  });
});

describe('buildAdminCalendar — SlotOverride BLOCK/OPEN', () => {
  it('BLOCK на существующей ячейке → blocked', () => {
    const overrides: AdminCalendarOverrideInput[] = [
      {
        kind: 'BLOCK',
        startsAt: new Date('2026-07-13T13:00:00Z'),
        durationMin: 50,
      },
    ];
    const days = base({ overrides });
    expect(cellAt(days, MONDAY, '2026-07-13T13:00:00.000Z')?.state).toBe(
      'blocked',
    );
  });

  it('BLOCK с пересечением (не точное совпадение startsAt) тоже даёт blocked', () => {
    const overrides: AdminCalendarOverrideInput[] = [
      {
        kind: 'BLOCK',
        startsAt: new Date('2026-07-13T13:30:00Z'),
        durationMin: 50,
      },
    ];
    const days = base({ overrides });
    // Ячейка правила 13:00–13:50 пересекается с BLOCK 13:30–14:20.
    const cell = cellAt(days, MONDAY, '2026-07-13T13:00:00.000Z');
    expect(cell?.state).toBe('blocked');
    // «Открыть» обязан снять именно эту строку, а не искать её по startsAt
    // ячейки (13:00 — там строки нет).
    expect(cell?.overrideStartsAt).toBe('2026-07-13T13:30:00.000Z');
    // Соседняя ячейка 14:00–14:50 тоже под тем же BLOCK (13:30–14:20).
    expect(cellAt(days, MONDAY, '2026-07-13T14:00:00.000Z')).toMatchObject({
      state: 'blocked',
      overrideStartsAt: '2026-07-13T13:30:00.000Z',
    });
  });

  it('overrideStartsAt есть только у blocked/extra — у free/off/booked его нет', () => {
    const overrides: AdminCalendarOverrideInput[] = [
      {
        kind: 'OPEN',
        startsAt: new Date('2026-07-13T19:00:00Z'),
        durationMin: 50,
      },
      {
        kind: 'BLOCK',
        startsAt: new Date('2026-07-13T10:00:00Z'),
        durationMin: 50,
      },
    ];
    const bookings: AdminCalendarBookingInput[] = [
      {
        id: 7,
        startsAt: new Date('2026-07-13T10:00:00Z'),
        durationMin: 50,
        clientName: 'Аня',
        status: 'CONFIRMED',
      },
    ];
    const days = base({ overrides, bookings });
    expect(cellAt(days, MONDAY, '2026-07-13T19:00:00.000Z')).toMatchObject({
      state: 'extra',
      overrideStartsAt: '2026-07-13T19:00:00.000Z',
    });
    expect(cellAt(days, MONDAY, '2026-07-13T09:00:00.000Z')).not.toHaveProperty(
      'overrideStartsAt',
    );
    // Бронь сильнее BLOCK — и поле override у booked-ячейки не выдаётся.
    expect(cellAt(days, MONDAY, '2026-07-13T10:00:00.000Z')).toMatchObject({
      state: 'booked',
    });
    expect(cellAt(days, MONDAY, '2026-07-13T10:00:00.000Z')).not.toHaveProperty(
      'overrideStartsAt',
    );
  });

  it('OPEN вне окна правила (19:00) — появляется новая ячейка extra', () => {
    const overrides: AdminCalendarOverrideInput[] = [
      {
        kind: 'OPEN',
        startsAt: new Date('2026-07-13T19:00:00Z'),
        durationMin: 45,
      },
    ];
    const days = base({ overrides });
    const cell = cellAt(days, MONDAY, '2026-07-13T19:00:00.000Z');
    expect(cell?.state).toBe('extra');
    expect(cell?.durationMin).toBe(45);
  });

  it('OPEN действует только по точному совпадению — не задевает соседние ячейки, которые он лишь перекрывает', () => {
    const tueRule: AdminCalendarRuleInput = {
      ...MON_RULE,
      dayOfWeek: 2,
      startHour: 12,
      endHour: 20,
    };
    const overrides: AdminCalendarOverrideInput[] = [
      {
        kind: 'OPEN',
        startsAt: new Date('2026-07-13T18:30:00Z'),
        durationMin: 50,
      },
    ];
    const days = base({ rules: [MON_RULE, tueRule], overrides });
    // 18:00/19:00 — off-ячейки общей оси (правило вторника расширяет окно до
    // 20:00); OPEN 18:30–19:20 пересекает обе, но не совпадает ни с одной.
    expect(cellAt(days, MONDAY, '2026-07-13T18:00:00.000Z')?.state).toBe('off');
    expect(cellAt(days, MONDAY, '2026-07-13T19:00:00.000Z')?.state).toBe('off');
    expect(cellAt(days, MONDAY, '2026-07-13T18:30:00.000Z')?.state).toBe(
      'extra',
    );
  });
});

describe('buildAdminCalendar — брони', () => {
  it('бронь на 10:00 → booked, с clientName/status и без лишних полей', () => {
    const bookings: AdminCalendarBookingInput[] = [
      {
        id: 5,
        startsAt: new Date('2026-07-13T10:00:00Z'),
        durationMin: 50,
        clientName: 'Мария',
        status: 'CONFIRMED',
      },
    ];
    const days = base({ bookings });
    const cell = cellAt(days, MONDAY, '2026-07-13T10:00:00.000Z');
    expect(cell?.state).toBe('booked');
    expect(cell?.booking).toEqual({
      id: 5,
      clientName: 'Мария',
      status: 'CONFIRMED',
    });
  });
});

describe('buildAdminCalendar — приоритет состояний', () => {
  it('booked побеждает blocked и busy на одной ячейке', () => {
    const at = new Date('2026-07-13T14:00:00Z');
    const days = base({
      bookings: [
        {
          id: 1,
          startsAt: at,
          durationMin: 50,
          clientName: 'Клиент',
          status: 'HELD',
        },
      ],
      overrides: [{ kind: 'BLOCK', startsAt: at, durationMin: 50 }],
      busy: [{ start: at, end: new Date(at.getTime() + 50 * 60_000) }],
      calendarBlocking: true,
    });
    expect(cellAt(days, MONDAY, '2026-07-13T14:00:00.000Z')?.state).toBe(
      'booked',
    );
  });

  it('blocked побеждает busy, когда брони нет', () => {
    const at = new Date('2026-07-13T14:00:00Z');
    const days = base({
      overrides: [{ kind: 'BLOCK', startsAt: at, durationMin: 50 }],
      busy: [{ start: at, end: new Date(at.getTime() + 50 * 60_000) }],
      calendarBlocking: true,
    });
    expect(cellAt(days, MONDAY, '2026-07-13T14:00:00.000Z')?.state).toBe(
      'blocked',
    );
  });
});

describe('buildAdminCalendar — фоновая ось и off-ячейки', () => {
  it('правило вторника 12–20 расширяет общую ось понедельника до 09–20: лишние часы — off, дубли не рождаются', () => {
    const tueRule: AdminCalendarRuleInput = {
      ...MON_RULE,
      dayOfWeek: 2,
      startHour: 12,
      endHour: 20,
    };
    const days = base({ rules: [MON_RULE, tueRule] });
    const monday = days.find((d) => d.date === MONDAY)!;
    // 9 ячеек правила (09..17) + 2 фоновых (18,19) — ни одной лишней/задвоенной.
    expect(monday.cells).toHaveLength(11);
    expect(cellAt(days, MONDAY, '2026-07-13T18:00:00.000Z')?.state).toBe('off');
    expect(cellAt(days, MONDAY, '2026-07-13T19:00:00.000Z')?.state).toBe('off');
    // Ни одна off-ячейка не встала поверх ячейки правила (09:00 — правило, не off).
    expect(cellAt(days, MONDAY, '2026-07-13T09:00:00.000Z')?.state).toBe(
      'free',
    );
  });

  it('день без правил (воскресенье) — только off-ячейки по общей оси одного правила', () => {
    const SUNDAY = '2026-07-12';
    const days = buildAdminCalendar({
      from: SUNDAY,
      to: SUNDAY,
      timezone: 'UTC',
      rules: [MON_RULE],
      overrides: [],
      bookings: [],
      busy: [],
      calendarBlocking: false,
      now: FAR_PAST_NOW,
    });
    const sunday = days[0];
    expect(sunday.cells).toHaveLength(9); // 09..17 по оси правила понедельника
    expect(sunday.cells.every((c) => c.state === 'off')).toBe(true);
  });

  it('правил нет вообще — ось по умолчанию 09:00–18:00 шагом 60 мин по 50', () => {
    const days = buildAdminCalendar({
      from: MONDAY,
      to: MONDAY,
      timezone: 'UTC',
      rules: [],
      overrides: [],
      bookings: [],
      busy: [],
      calendarBlocking: false,
      now: FAR_PAST_NOW,
    });
    const cells = days[0].cells;
    expect(cells).toHaveLength(9);
    expect(cells[0].startsAt).toBe('2026-07-13T09:00:00.000Z');
    expect(cells[0].durationMin).toBe(50);
    expect(cells[0].state).toBe('off');
  });
});

describe('buildAdminCalendar — past, сортировка, диапазон дат', () => {
  it('past = startsAt <= now + MIN_BOOK_LEAD_HOURS', () => {
    const days = base({ now: new Date('2026-07-12T23:00:00Z') }); // earliest = 13.07 11:00Z
    expect(cellAt(days, MONDAY, '2026-07-13T11:00:00.000Z')?.past).toBe(true);
    expect(cellAt(days, MONDAY, '2026-07-13T12:00:00.000Z')?.past).toBe(false);
  });

  it('ячейки дня отсортированы по startsAt', () => {
    const overrides: AdminCalendarOverrideInput[] = [
      {
        kind: 'OPEN',
        startsAt: new Date('2026-07-13T05:00:00Z'),
        durationMin: 30,
      },
    ];
    const days = base({ overrides });
    const times = days[0].cells.map((c) => c.startsAt);
    expect(times).toEqual([...times].sort());
  });

  it('ровно по одному дню на каждую дату диапазона, по порядку', () => {
    const days = buildAdminCalendar({
      from: '2026-07-13',
      to: '2026-07-15',
      timezone: 'UTC',
      rules: [MON_RULE],
      overrides: [],
      bookings: [],
      busy: [],
      calendarBlocking: false,
      now: FAR_PAST_NOW,
    });
    expect(days.map((d) => d.date)).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
    ]);
  });
});
