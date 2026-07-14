// Регрессия на P-5 (аудит 2026-07): расписание проверялось только при
// отображении слотов (SlotService), а прямой POST /api/booking/book принимал
// произвольные startsAt/durationMin — бронировалось 3 часа ночи любой длины.
import { BadRequestException } from '@nestjs/common';
import { BookingService } from './booking.service';

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
  };
  const service = new BookingService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { get: () => undefined } as any,
  );
  // Тестируем приватный метод напрямую — book() тянет много зависимостей.
  const assert = (startsAt: Date, durationMin: number) =>
    (service as any).assertWithinAvailability(startsAt, durationMin);
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
