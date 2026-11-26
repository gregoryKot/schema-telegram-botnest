// Окно ручного слоя SlotOverride в SlotService.getSlots: что забирается из
// БД и что из забранного доходит до выдачи. Выжившие мутанты храповика
// 2026-09-29: тесты slot.service.spec.ts держали «сейчас» в полночь запроса,
// и OPEN до окна отсекался минимальным лид-таймом, а не фильтром окна, —
// фильтр можно было удалить целиком, и ни один тест бы не покраснел.
import { ConfigService } from '@nestjs/config';
import { SlotService } from './slot.service';

interface OverrideRow {
  kind: 'BLOCK' | 'OPEN';
  startsAt: Date;
  durationMin: number;
}

function makeService(rules: object[], overrides: OverrideRow[]) {
  const prisma = {
    availabilityRule: { findMany: jest.fn(() => Promise.resolve(rules)) },
    slotOverride: { findMany: jest.fn(() => Promise.resolve(overrides)) },
    booking: { findMany: jest.fn(() => Promise.resolve([])) },
  };
  const calDav = { getBusyTimes: jest.fn(() => Promise.resolve([])) };
  const config = { get: () => undefined } as unknown as ConfigService;
  const service = new SlotService(prisma as never, calDav as never, config);
  return { service, prisma };
}

const MONDAY = new Date('2026-07-13T00:00:00Z');
// Правило в UTC с первым слотом ровно в полночь — на границе окна.
const MIDNIGHT_RULE = {
  id: 1,
  dayOfWeek: 1,
  startHour: 0,
  startMinute: 0,
  endHour: 2,
  endMinute: 0,
  sessionDuration: 50,
  bufferMin: 10,
  timezone: 'UTC',
  isActive: true,
};
const iso = (slots: { startsAt: Date }[]) =>
  slots.map((s) => s.startsAt.toISOString());

describe('SlotService.getSlots — окно ручного слоя SlotOverride', () => {
  // «Сейчас» задолго до запроса: лид-тайм ничего не отсекает, и отсев OPEN
  // вне окна виден только через фильтр окна.
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-01T00:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('из БД берутся override-ы с запасом 180 мин до окна и до его конца', async () => {
    const { service, prisma } = makeService([MIDNIGHT_RULE], []);
    await service.getSlots(MONDAY, MONDAY);
    expect(prisma.slotOverride.findMany).toHaveBeenCalledWith({
      where: {
        startsAt: {
          gte: new Date('2026-07-12T21:00:00.000Z'),
          lte: new Date('2026-07-13T23:59:59.999Z'),
        },
      },
    });
  });

  it('BLOCK, начавшийся до окна, всё равно закрывает слот в окне', async () => {
    const { service } = makeService(
      [MIDNIGHT_RULE],
      [
        {
          kind: 'BLOCK',
          startsAt: new Date('2026-07-12T23:30:00Z'),
          durationMin: 60,
        },
      ],
    );
    const slots = await service.getSlots(MONDAY, MONDAY);
    expect(iso(slots)).toEqual(['2026-07-13T01:00:00.000Z']);
  });

  it('OPEN до окна не отдаётся, OPEN ровно в начале окна — отдаётся', async () => {
    const { service } = makeService(
      [],
      [
        {
          kind: 'OPEN',
          startsAt: new Date('2026-07-12T23:00:00Z'),
          durationMin: 50,
        },
        { kind: 'OPEN', startsAt: MONDAY, durationMin: 50 },
      ],
    );
    const slots = await service.getSlots(MONDAY, MONDAY);
    expect(iso(slots)).toEqual(['2026-07-13T00:00:00.000Z']);
  });

  it('без правил и без OPEN — ранний выход: одни BLOCK не ведут к запросу броней', async () => {
    const { service, prisma } = makeService(
      [],
      [{ kind: 'BLOCK', startsAt: MONDAY, durationMin: 50 }],
    );
    expect(await service.getSlots(MONDAY, MONDAY)).toEqual([]);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });
});
