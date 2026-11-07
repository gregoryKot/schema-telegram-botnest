// Регрессия на P-5 (аудит 2026-07): расписание проверялось только при
// отображении слотов (SlotService), а прямой POST /api/booking/book принимал
// произвольные startsAt/durationMin — бронировалось 3 часа ночи любой длины.
import { BadRequestException } from '@nestjs/common';
import { assertWithinAvailability } from './booking.availability';

// Понедельник 2026-07-13, окно 10:00–19:00 Europe/Moscow (UTC+3).
const RULE = {
  id: 1,
  dayOfWeek: 1, // Mon
  startHour: 10,
  startMinute: 0,
  endHour: 19,
  endMinute: 0,
  sessionDuration: 50,
  bufferMin: 10,
  timezone: 'Europe/Moscow',
  isActive: true,
};

function makeService(rules: any[]) {
  const prisma: any = {
    availabilityRule: { findMany: jest.fn(async () => rules) },
    slotOverride: { findMany: jest.fn(async () => []) },
  };
  const assert = (startsAt: Date, durationMin: number) =>
    assertWithinAvailability(prisma, startsAt, durationMin);
  return { assert };
}

describe('BookingService.assertWithinAvailability (P-5)', () => {
  it('слот внутри окна проходит (пн 12:00 МСК, 50 мин)', async () => {
    const { assert } = makeService([RULE]);
    await expect(
      assert(new Date('2026-07-13T09:00:00Z'), 50),
    ).resolves.toBeUndefined();
  });

  it('другой день недели — отказ (вс 12:00 МСК)', async () => {
    const { assert } = makeService([RULE]);
    await expect(assert(new Date('2026-07-12T09:00:00Z'), 50)).rejects.toThrow(
      'OUTSIDE_AVAILABILITY',
    );
  });

  it('3 часа ночи — отказ', async () => {
    const { assert } = makeService([RULE]);
    await expect(assert(new Date('2026-07-13T00:00:00Z'), 50)).rejects.toThrow(
      'OUTSIDE_AVAILABILITY',
    );
  });

  it('сессия вылезает за конец окна — отказ (18:30 + 50 мин > 19:00)', async () => {
    const { assert } = makeService([RULE]);
    await expect(assert(new Date('2026-07-13T15:30:00Z'), 50)).rejects.toThrow(
      'OUTSIDE_AVAILABILITY',
    );
  });

  it('абсурдная длительность — отказ до чтения правил', async () => {
    const { assert } = makeService([RULE]);
    await expect(assert(new Date('2026-07-13T09:00:00Z'), 600)).rejects.toThrow(
      BadRequestException,
    );
    await expect(assert(new Date('2026-07-13T09:00:00Z'), 0)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('правил нет (dev) — пропускаем, прежнее поведение', async () => {
    const { assert } = makeService([]);
    await expect(
      assert(new Date('2026-07-13T00:00:00Z'), 50),
    ).resolves.toBeUndefined();
  });

  // Границы валидации длительности (15–180 мин включительно) — без правил,
  // чтобы изолировать именно проверку длительности от проверки окна.
  it('граница длительности: 15 мин — валидна, 14 — отказ', async () => {
    const { assert } = makeService([]);
    await expect(
      assert(new Date('2026-07-13T09:00:00Z'), 15),
    ).resolves.toBeUndefined();
    await expect(assert(new Date('2026-07-13T09:00:00Z'), 14)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('граница длительности: 180 мин — валидна, 181 — отказ', async () => {
    const { assert } = makeService([]);
    await expect(
      assert(new Date('2026-07-13T09:00:00Z'), 180),
    ).resolves.toBeUndefined();
    await expect(assert(new Date('2026-07-13T09:00:00Z'), 181)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('нецелая длительность — отказ', async () => {
    const { assert } = makeService([]);
    await expect(
      assert(new Date('2026-07-13T09:00:00Z'), 50.5),
    ).rejects.toThrow(BadRequestException);
  });
});

// Бронь любой длины и вне сетки (аудит 2026-11, P2): проверка «интервал
// влезает в окно правила» пропускала INTRO_15 на 180 минут (бесплатно, сразу
// CONFIRMED) и старт 12:30 при сетке 12:00/13:00 (занимал два слота). Теперь
// бронь обязана быть слотом, который отдаёт /slots: начало на сетке правила и
// длина ровно sessionDuration.
describe('assertWithinAvailability — только слоты сетки правила', () => {
  it('INTRO_15 на 180 мин на слоте сетки (12:00 МСК) — 400', async () => {
    const { assert } = makeService([RULE]);
    await expect(assert(new Date('2026-07-13T09:00:00Z'), 180)).rejects.toThrow(
      new BadRequestException('OUTSIDE_AVAILABILITY'),
    );
  });

  it('короче слота (15 мин на 50-минутной сетке) — тоже 400: такого слота сервер не предлагал', async () => {
    const { assert } = makeService([RULE]);
    await expect(assert(new Date('2026-07-13T09:00:00Z'), 15)).rejects.toThrow(
      'OUTSIDE_AVAILABILITY',
    );
  });

  it('начало вне сетки (12:30 МСК при слотах 12:00/13:00) — 400, хотя в окно влезает', async () => {
    const { assert } = makeService([RULE]);
    await expect(assert(new Date('2026-07-13T09:30:00Z'), 50)).rejects.toThrow(
      'OUTSIDE_AVAILABILITY',
    );
  });

  it('ровно слот правила проходит: первый (10:00) и последний (18:00) слоты дня', async () => {
    const { assert } = makeService([RULE]);
    await expect(
      assert(new Date('2026-07-13T07:00:00Z'), 50),
    ).resolves.toBeUndefined();
    await expect(
      assert(new Date('2026-07-13T15:00:00Z'), 50),
    ).resolves.toBeUndefined();
  });

  it('OPEN-оверрайд вне правил проходит с его длиной', async () => {
    const prisma: any = {
      availabilityRule: { findMany: jest.fn(async () => [RULE]) },
      slotOverride: {
        findMany: jest.fn(async () => [
          {
            kind: 'OPEN',
            startsAt: new Date('2026-07-13T19:00:00Z'), // пн 22:00 МСК
            durationMin: 45,
          },
        ]),
      },
    };
    await expect(
      assertWithinAvailability(prisma, new Date('2026-07-13T19:00:00Z'), 45),
    ).resolves.toBeUndefined();
  });

  // Зона западнее UTC: местный понедельник 21:00 в Нью-Йорке — это уже
  // вторник по UTC. День недели и сетка берутся из местной даты правила, как
  // в SlotService.getSlots, а не из UTC-даты момента.
  it('местная дата правила, а не UTC: пн 21:00 America/New_York = вт 01:00 UTC — проходит', async () => {
    const ny = {
      ...RULE,
      startHour: 18,
      endHour: 23,
      timezone: 'America/New_York',
    };
    const { assert } = makeService([ny]);
    await expect(
      assert(new Date('2026-07-14T01:00:00Z'), 50),
    ).resolves.toBeUndefined();
  });
});
