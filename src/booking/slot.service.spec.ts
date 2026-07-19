// Прямой тест SlotService (ранее покрывался только косвенно). Генерация
// слотов, границы окна, буфер, пересечения с бронями/календарём, DST —
// ошибка тут либо прячет слот, либо показывает занятое время свободным.
import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';
import { SlotService } from './slot.service';
import { MIN_BOOK_LEAD_HOURS } from './booking.config';

function makeService(opts: {
  rules?: any[];
  bookings?: any[];
  busy?: { start: Date; end: Date }[];
  blockBusy?: boolean;
}) {
  const prisma: any = {
    availabilityRule: {
      findMany: jest.fn(() => Promise.resolve(opts.rules ?? [])),
    },
    booking: {
      findMany: jest.fn(({ where }: any) => {
        const from: Date = where.startsAt.gte;
        const to: Date = where.startsAt.lte;
        const statuses: string[] = where.status.in;
        return Promise.resolve(
          (opts.bookings ?? []).filter(
            (b) =>
              statuses.includes(b.status) &&
              b.startsAt >= from &&
              b.startsAt <= to,
          ),
        );
      }),
    },
  };
  const calDav: any = {
    getBusyTimes: jest.fn(() => Promise.resolve(opts.busy ?? [])),
  };
  const config = {
    get: (key: string) =>
      key === 'CALENDAR_BLOCK_SLOTS' && opts.blockBusy ? 'true' : undefined,
  } as unknown as ConfigService;
  const service = new SlotService(prisma, calDav, config);
  return { service, prisma, calDav };
}

// Понедельник 2026-07-13 00:00 UTC. Окно правила 20:00–22:00 МСК (UTC+3) =
// 17:00–19:00 UTC, чтобы не упереться в MIN_BOOK_LEAD_HOURS при "now"=полночь.
const MONDAY = new Date('2026-07-13T00:00:00Z');
const RULE = {
  id: 1,
  dayOfWeek: 1,
  startHour: 20,
  startMinute: 0,
  endHour: 22,
  endMinute: 0,
  sessionDuration: 50,
  bufferMin: 10,
  timezone: 'Europe/Moscow',
  isActive: true,
};

describe('SlotService.getSlots — базовая генерация и границы окна', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
  });
  afterEach(() => jest.useRealTimers());

  it('без активных правил — пустой список, бронирования не запрашиваются', async () => {
    const { service, prisma } = makeService({ rules: [] });
    const slots = await service.getSlots(MONDAY, MONDAY);
    expect(slots).toEqual([]);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('генерирует слоты с шагом sessionDuration+bufferMin (буфер соблюдён)', async () => {
    const { service } = makeService({ rules: [RULE] });
    const slots = await service.getSlots(MONDAY, MONDAY);
    // 17:00–19:00 UTC, 50 мин сессии, шаг 60 мин: 17:00 и 18:00.
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-07-13T17:00:00.000Z',
      '2026-07-13T18:00:00.000Z',
    ]);
    expect(slots[0].endsAt.toISOString()).toBe('2026-07-13T17:50:00.000Z');
    // Разрыв между концом первого и началом второго = буфер (10 мин), а не 0.
    const gapMin =
      (slots[1].startsAt.getTime() - slots[0].endsAt.getTime()) / 60_000;
    expect(gapMin).toBe(10);
  });

  it('слот, вылезающий за конец окна, не создаётся (граничная проверка t+duration<=slotEnd)', async () => {
    const rule = { ...RULE, endHour: 21, endMinute: 10 }; // окно 17:00–18:10 UTC
    const { service } = makeService({ rules: [rule] });
    const slots = await service.getSlots(MONDAY, MONDAY);
    // Второй слот 18:00–18:50 вылезает за 18:10 → отсекается.
    expect(slots).toHaveLength(1);
    expect(slots[0].startsAt.toISOString()).toBe('2026-07-13T17:00:00.000Z');
  });

  it('правило другого дня недели не порождает слотов в этот день', async () => {
    const rule = { ...RULE, dayOfWeek: 2 }; // вторник, а MONDAY — понедельник
    const { service } = makeService({ rules: [rule] });
    expect(await service.getSlots(MONDAY, MONDAY)).toEqual([]);
  });

  it('несколько правил в один день — слоты от каждого, итог отсортирован по времени', async () => {
    const early = { ...RULE, startHour: 8, endHour: 9 }; // МСК 08–09 = 05–06 UTC
    const late = { ...RULE, startHour: 20, endHour: 21 }; // МСК 20–21 = 17–18 UTC
    const { service } = makeService({ rules: [late, early] });
    const slots = await service.getSlots(MONDAY, MONDAY);
    const times = slots.map((s) => s.startsAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe('SlotService.getSlots — минимальный лид-тайм (MIN_BOOK_LEAD_HOURS)', () => {
  afterEach(() => jest.useRealTimers());

  it('слот раньше now+MIN_BOOK_LEAD_HOURS отфильтрован', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
    const { service } = makeService({ rules: [RULE] });
    const earliest = MONDAY.getTime() + MIN_BOOK_LEAD_HOURS * 3_600_000;
    const slots = await service.getSlots(MONDAY, MONDAY);
    for (const s of slots) {
      expect(s.startsAt.getTime()).toBeGreaterThan(earliest);
    }
  });

  it('now сдвинут так, что окно правила целиком раньше лид-тайма — слотов нет', async () => {
    // now = 08:00 UTC понедельника → earliest = 20:00 UTC, окно правила 17–19 UTC целиком раньше.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-13T08:00:00Z'));
    const { service } = makeService({ rules: [RULE] });
    expect(await service.getSlots(MONDAY, MONDAY)).toEqual([]);
  });
});

describe('SlotService.getSlots — пересечения с существующими бронями', () => {
  // prisma-запрос ищет брони строго внутри [fromDate,toDate] (не "весь день",
  // как cursor генерации слотов) — окно должно покрывать весь понедельник.
  const MONDAY_END = new Date('2026-07-13T23:59:59.999Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
  });
  afterEach(() => jest.useRealTimers());

  it('HELD/CONFIRMED бронь, пересекающая слот, исключает именно его', async () => {
    const booking = {
      startsAt: new Date('2026-07-13T17:00:00.000Z'),
      durationMin: 50,
      status: BookingStatus.CONFIRMED,
    };
    const { service } = makeService({ rules: [RULE], bookings: [booking] });
    const slots = await service.getSlots(MONDAY, MONDAY_END);
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-07-13T18:00:00.000Z',
    ]);
  });

  it('частичное пересечение (бронь начинается посреди слота) тоже блокирует слот', async () => {
    const booking = {
      startsAt: new Date('2026-07-13T17:30:00.000Z'), // внутри 17:00–17:50
      durationMin: 50,
      status: BookingStatus.CONFIRMED,
    };
    const { service } = makeService({ rules: [RULE], bookings: [booking] });
    const slots = await service.getSlots(MONDAY, MONDAY_END);
    expect(
      slots.some(
        (s) => s.startsAt.toISOString() === '2026-07-13T17:00:00.000Z',
      ),
    ).toBe(false);
  });

  it('бронь, вплотную примыкающая к слоту (endsAt === slot.startsAt), НЕ считается пересечением', async () => {
    const booking = {
      startsAt: new Date('2026-07-13T16:10:00.000Z'),
      durationMin: 50, // заканчивается ровно в 17:00
      status: BookingStatus.CONFIRMED,
    };
    const { service } = makeService({ rules: [RULE], bookings: [booking] });
    const slots = await service.getSlots(MONDAY, MONDAY_END);
    expect(slots.map((s) => s.startsAt.toISOString())).toContain(
      '2026-07-13T17:00:00.000Z',
    );
  });

  it('CANCELLED-бронь не блокирует слот (не в фильтре HELD/CONFIRMED)', async () => {
    // Фейковый prisma фильтрует по статусу как настоящий — эта бронь просто
    // не попадёт в busyBookings, слот останется свободным.
    const booking = {
      startsAt: new Date('2026-07-13T17:00:00.000Z'),
      durationMin: 50,
      status: BookingStatus.CANCELLED,
    };
    const { service } = makeService({ rules: [RULE], bookings: [booking] });
    const slots = await service.getSlots(MONDAY, MONDAY_END);
    expect(slots.map((s) => s.startsAt.toISOString())).toContain(
      '2026-07-13T17:00:00.000Z',
    );
  });
});

describe('SlotService.getSlots — занятость из внешнего календаря (CalDAV)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
  });
  afterEach(() => jest.useRealTimers());

  it('CALENDAR_BLOCK_SLOTS выключен (дефолт) — calDav.getBusyTimes не вызывается', async () => {
    const { service, calDav } = makeService({
      rules: [RULE],
      blockBusy: false,
    });
    await service.getSlots(MONDAY, MONDAY);
    expect(calDav.getBusyTimes).not.toHaveBeenCalled();
  });

  it('CALENDAR_BLOCK_SLOTS включён — занятый интервал из календаря вычёркивает пересекающийся слот', async () => {
    const busy = [
      {
        start: new Date('2026-07-13T17:20:00.000Z'),
        end: new Date('2026-07-13T17:40:00.000Z'),
      },
    ];
    const { service, calDav } = makeService({
      rules: [RULE],
      blockBusy: true,
      busy,
    });
    const slots = await service.getSlots(MONDAY, MONDAY);
    expect(calDav.getBusyTimes).toHaveBeenCalledWith(MONDAY, MONDAY);
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-07-13T18:00:00.000Z',
    ]);
  });
});

describe('SlotService.getSlots — часовые пояса и переход на летнее время (DST)', () => {
  afterEach(() => jest.useRealTimers());

  // "now" в далёком прошлом, чтобы MIN_BOOK_LEAD_HOURS не участвовал в тесте.
  const FAR_PAST = new Date('2000-01-01T00:00:00Z');

  // ФИКС (было найдено и задокументировано, потом исправлено в slot.service.ts):
  // день недели и календарная дата правила теперь берутся из ОДНОЙ и той же
  // локальной даты (localDate/localMidnightUTC из utils/tz.ts) — для тайзоны
  // западнее UTC (America/New_York) слот корректно попадает на местный
  // запрошенный день, а не на день раньше. Тесты ниже проверяют ПРАВИЛЬНОЕ
  // поведение (было наоборот, см. git-историю этого файла).
  it('America/New_York ДО перехода на летнее время — офсет EST (UTC-5), слот на запрошенный местный день', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(FAR_PAST);
    // 2026-03-01 — воскресенье, ещё EST (переход 2026-03-08).
    const day = new Date('2026-03-01T00:00:00Z');
    const rule = {
      ...RULE,
      dayOfWeek: day.getUTCDay(),
      startHour: 10,
      startMinute: 0,
      endHour: 11,
      endMinute: 0,
      timezone: 'America/New_York',
    };
    const { service } = makeService({ rules: [rule] });
    const slots = await service.getSlots(day, day);
    expect(slots).toHaveLength(1);
    // 10:00 EST 2026-03-01 = 15:00 UTC ТОГО ЖЕ запрошенного дня.
    expect(slots[0].startsAt.toISOString()).toBe('2026-03-01T15:00:00.000Z');
  });

  it('America/New_York ПОСЛЕ перехода на летнее время — офсет EDT (UTC-4), слот на запрошенный местный день', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(FAR_PAST);
    // 2026-03-15 — то же воскресенье через 2 недели, уже EDT.
    const day = new Date('2026-03-15T00:00:00Z');
    const rule = {
      ...RULE,
      dayOfWeek: day.getUTCDay(),
      startHour: 10,
      startMinute: 0,
      endHour: 11,
      endMinute: 0,
      timezone: 'America/New_York',
    };
    const { service } = makeService({ rules: [rule] });
    const slots = await service.getSlots(day, day);
    expect(slots).toHaveLength(1);
    // 10:00 EDT 2026-03-15 = 14:00 UTC ТОГО ЖЕ запрошенного дня (на час
    // раньше EST-случая выше — DST-математика localMidnightUTC верна).
    expect(slots[0].startsAt.toISOString()).toBe('2026-03-15T14:00:00.000Z');
  });

  it('west-of-UTC рассинхрон дня недели: правило Sunday не протекает в запрос за Monday', async () => {
    // До фикса запас курсора без итогового range-фильтра мог бы вернуть
    // соседний локальный день; здесь явно проверяем, что окно [from,to]
    // строго соблюдается для чужого дня недели.
    jest.useFakeTimers();
    jest.setSystemTime(FAR_PAST);
    const monday = new Date('2026-03-02T00:00:00Z');
    const rule = {
      ...RULE,
      dayOfWeek: 0, // Sunday (2026-03-01), а запрашиваем Monday
      startHour: 10,
      endHour: 11,
      timezone: 'America/New_York',
    };
    const { service } = makeService({ rules: [rule] });
    expect(await service.getSlots(monday, monday)).toEqual([]);
  });

  it('Europe/Moscow: результат побайтово идентичен поведению до фикса (регрессия)', async () => {
    // Прод-таймзона восточнее UTC — фикс НЕ должен менять её вывод.
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
    const { service } = makeService({ rules: [RULE] });
    const slots = await service.getSlots(MONDAY, MONDAY);
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-07-13T17:00:00.000Z',
      '2026-07-13T18:00:00.000Z',
    ]);
  });
});
