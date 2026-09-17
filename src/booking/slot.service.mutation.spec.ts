// Точечное усиление slot.service.ts против выживших мутантов (Stryker
// waveB): точный select/where в prisma-запросах, rangeStart-полночь,
// арифметика минут правила, границы </<=, >/>= на краях окна/лид-тайма,
// сортировка и boundary-условия пересечений (booking/calDAV busy).
import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';
import { SlotService } from './slot.service';

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

describe('SlotService.getSlots — точные аргументы Prisma-запросов', () => {
  it('availabilityRule.findMany вызван с where:{isActive:true} (не пустой объект)', async () => {
    const { service, prisma } = makeService({ rules: [RULE] });
    await service.getSlots(MONDAY, MONDAY);
    expect(prisma.availabilityRule.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
    });
  });

  it('booking.findMany вызван с select:{startsAt:true,durationMin:true} (не пустой select)', async () => {
    const { service, prisma } = makeService({ rules: [RULE] });
    await service.getSlots(MONDAY, MONDAY);
    const call = prisma.booking.findMany.mock.calls[0][0];
    expect(call.select).toEqual({ startsAt: true, durationMin: true });
  });
});

describe('SlotService.getSlots — rangeStart truncates to UTC midnight (setUTCHours vs setUTCMinutes)', () => {
  afterEach(() => jest.useRealTimers());

  it('fromDate с ненулевым временем (05:00 UTC) не отсекает более ранний слот того же дня', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2000-01-01T00:00:00Z')); // далеко в прошлом — лид-тайм не мешает
    // Правило генерит слот в 02:00-02:50 UTC (05:00 МСК) того же понедельника.
    const earlyRule = {
      ...RULE,
      startHour: 5,
      startMinute: 0,
      endHour: 6,
      endMinute: 0,
    };
    const fromDate = new Date('2026-07-13T05:00:00Z'); // не полночь!
    const toDate = new Date('2026-07-13T23:59:59.999Z');
    const { service } = makeService({ rules: [earlyRule] });
    const slots = await service.getSlots(fromDate, toDate);
    // Реальный код: rangeStart truncates к 00:00 UTC → слот в 02:00 UTC входит.
    // Мутант (setUTCMinutes вместо setUTCHours) оставил бы rangeStart=05:00,
    // и слот 02:00 был бы отфильтрован строкой "start < rangeStart".
    expect(slots.map((s) => s.startsAt.toISOString())).toContain(
      '2026-07-13T02:00:00.000Z',
    );
  });
});

describe('SlotService.getSlots — граница t+duration<=slotEnd (EqualityOperator)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
  });
  afterEach(() => jest.useRealTimers());

  it('слот, ровно заполняющий окно целиком (без буфера) — включён (<=, не <)', async () => {
    // Окно 20:00-21:00 МСК = 17:00-18:00 UTC, сессия 60 мин без буфера —
    // единственный слот заканчивается РОВНО на границе окна.
    const rule = {
      ...RULE,
      endHour: 21,
      endMinute: 0,
      sessionDuration: 60,
      bufferMin: 0,
    };
    const { service } = makeService({ rules: [rule] });
    const slots = await service.getSlots(MONDAY, MONDAY);
    expect(slots).toHaveLength(1);
    expect(slots[0].endsAt.toISOString()).toBe('2026-07-13T18:00:00.000Z');
  });
});

describe('SlotService.getSlots — границы rangeStart/rangeEnd (start</> vs <=/>=)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2000-01-01T00:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('слот, начинающийся РОВНО в rangeStart — включён (не строгое <)', async () => {
    const fromDate = new Date('2026-07-13T17:00:00Z');
    const toDate = new Date('2026-07-13T23:59:59.999Z');
    const { service } = makeService({ rules: [RULE] });
    const slots = await service.getSlots(fromDate, toDate);
    expect(slots.map((s) => s.startsAt.toISOString())).toContain(
      '2026-07-13T17:00:00.000Z',
    );
  });

  it('слот, начинающийся РОВНО в rangeEnd — включён (не строгое >, EqualityOperator >=rangeEnd)', async () => {
    // Второй слот правила стартует в 18:00 UTC — делаем его ровно rangeEnd.
    const fromDate = new Date('2026-07-13T00:00:00Z');
    const toDate = new Date('2026-07-13T18:00:00.000Z');
    const { service } = makeService({ rules: [RULE] });
    const slots = await service.getSlots(fromDate, toDate);
    expect(slots.map((s) => s.startsAt.toISOString())).toContain(
      '2026-07-13T18:00:00.000Z',
    );
  });
});

describe('SlotService.getSlots — минимальный лид-тайм: граница <= earliest', () => {
  it('слот, начинающийся РОВНО в момент earliest — исключён (<=, не <)', async () => {
    // earliest = now + MIN_BOOK_LEAD_HOURS(12ч). Ставим now так, чтобы первый
    // слот 17:00 UTC совпал с earliest ровно.
    const now = new Date(
      new Date('2026-07-13T17:00:00Z').getTime() - 12 * 3_600_000,
    );
    jest.useFakeTimers();
    jest.setSystemTime(now);
    const { service } = makeService({ rules: [RULE] });
    const slots = await service.getSlots(MONDAY, MONDAY);
    jest.useRealTimers();
    expect(
      slots.some(
        (s) => s.startsAt.toISOString() === '2026-07-13T17:00:00.000Z',
      ),
    ).toBe(false);
  });

  it('слот на 1 минуту позже earliest — включён', async () => {
    const now = new Date(
      new Date('2026-07-13T17:00:00Z').getTime() - 12 * 3_600_000 - 60_000,
    );
    jest.useFakeTimers();
    jest.setSystemTime(now);
    const { service } = makeService({ rules: [RULE] });
    const slots = await service.getSlots(MONDAY, MONDAY);
    jest.useRealTimers();
    expect(
      slots.some(
        (s) => s.startsAt.toISOString() === '2026-07-13T17:00:00.000Z',
      ),
    ).toBe(true);
  });
});

describe('SlotService.getSlots — итоговая сортировка (arithmetic a-b, не a+b)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Далеко в прошлом — иначе ранний слот (05:00 UTC) отсекается лид-таймом
    // MIN_BOOK_LEAD_HOURS от "текущего" MONDAY 00:00.
    jest.setSystemTime(new Date('2000-01-01T00:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('правила в обратном хронологическом порядке — итог строго по возрастанию времени', async () => {
    const early = { ...RULE, startHour: 8, endHour: 9 }; // 05-06 UTC
    const late = { ...RULE, startHour: 20, endHour: 21 }; // 17-18 UTC
    const { service } = makeService({ rules: [late, early] });
    const slots = await service.getSlots(MONDAY, MONDAY);
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-07-13T05:00:00.000Z',
      '2026-07-13T17:00:00.000Z',
    ]);
  });
});

describe('SlotService.getSlots — граница пересечения с CalDAV-занятостью (overlapsBusy)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
  });
  afterEach(() => jest.useRealTimers());

  it('занятость заканчивается РОВНО в начале слота — НЕ пересекается (граница исключительна)', async () => {
    const busy = [
      {
        start: new Date('2026-07-13T16:10:00.000Z'),
        end: new Date('2026-07-13T17:00:00.000Z'), // ровно старт слота
      },
    ];
    const { service } = makeService({ rules: [RULE], blockBusy: true, busy });
    const slots = await service.getSlots(MONDAY, MONDAY);
    expect(slots.map((s) => s.startsAt.toISOString())).toContain(
      '2026-07-13T17:00:00.000Z',
    );
  });

  it('занятость начинается РОВНО в конце слота — НЕ пересекается (граница исключительна)', async () => {
    const busy = [
      {
        start: new Date('2026-07-13T17:50:00.000Z'), // ровно конец слота 17:00-17:50
        end: new Date('2026-07-13T18:30:00.000Z'),
      },
    ];
    const { service } = makeService({ rules: [RULE], blockBusy: true, busy });
    const slots = await service.getSlots(MONDAY, MONDAY);
    expect(slots.map((s) => s.startsAt.toISOString())).toContain(
      '2026-07-13T17:00:00.000Z',
    );
  });

  it('занятость на 1 минуту заходит внутрь слота — пересечение есть, слот исключён', async () => {
    const busy = [
      {
        start: new Date('2026-07-13T17:49:00.000Z'),
        end: new Date('2026-07-13T18:30:00.000Z'),
      },
    ];
    const { service } = makeService({ rules: [RULE], blockBusy: true, busy });
    const slots = await service.getSlots(MONDAY, MONDAY);
    expect(slots.map((s) => s.startsAt.toISOString())).not.toContain(
      '2026-07-13T17:00:00.000Z',
    );
  });

  it('занятость совсем в другом времени (не пересекается вообще) — оба слота остаются (ConditionalExpression всегда true)', async () => {
    const busy = [
      {
        start: new Date('2026-07-13T05:00:00.000Z'),
        end: new Date('2026-07-13T06:00:00.000Z'),
      },
    ];
    const { service } = makeService({ rules: [RULE], blockBusy: true, busy });
    const slots = await service.getSlots(MONDAY, MONDAY);
    expect(slots).toHaveLength(2);
  });
});

describe('SlotService.getSlots — арифметика be=bs+durationMin*60000 (не деление)', () => {
  const MONDAY_END = new Date('2026-07-13T23:59:59.999Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MONDAY);
  });
  afterEach(() => jest.useRealTimers());

  it('длинная бронь (170 мин) полностью перекрывает окно — оба потенциальных слота исключены', async () => {
    // Мутация "/" вместо "+" сделала бы be крошечным числом, и isOccupied
    // перестал бы вообще блокировать слоты — эта проверка это ловит.
    const booking = {
      startsAt: new Date('2026-07-13T17:00:00.000Z'),
      durationMin: 170, // 17:00–19:50, покрывает оба слота окна
      status: BookingStatus.CONFIRMED,
    };
    const { service } = makeService({ rules: [RULE], bookings: [booking] });
    const slots = await service.getSlots(MONDAY, MONDAY_END);
    expect(slots).toEqual([]);
  });

  it('бронь совсем в другом времени — оба слота остаются (ConditionalExpression на isOccupied всегда true)', async () => {
    const booking = {
      startsAt: new Date('2026-07-13T05:00:00.000Z'),
      durationMin: 50,
      status: BookingStatus.CONFIRMED,
    };
    const { service } = makeService({ rules: [RULE], bookings: [booking] });
    const slots = await service.getSlots(MONDAY, MONDAY_END);
    expect(slots).toHaveLength(2);
  });

  it('бронь начинается РОВНО в конец первого слота (17:50) — первый слот НЕ занят (EqualityOperator end.getTime()>=bs)', async () => {
    const booking = {
      startsAt: new Date('2026-07-13T17:50:00.000Z'), // ровно endsAt первого слота
      durationMin: 50,
      status: BookingStatus.CONFIRMED,
    };
    const { service } = makeService({ rules: [RULE], bookings: [booking] });
    const slots = await service.getSlots(MONDAY, MONDAY_END);
    expect(slots.map((s) => s.startsAt.toISOString())).toContain(
      '2026-07-13T17:00:00.000Z',
    );
  });
});
