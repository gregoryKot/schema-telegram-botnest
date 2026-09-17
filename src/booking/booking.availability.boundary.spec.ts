// Точечное усиление assertWithinAvailability против выживших мутантов:
// rules.some→every, арифметика минут (startHour*60±startMinute), границы
// >=/<= на старте/конце окна. Дополняет booking.availability.spec.ts,
// который проверял поведение, но не эти конкретные операторы/границы.
import { assertWithinAvailability } from './booking.availability';

function makeService(rules: any[]) {
  const prisma: any = {
    availabilityRule: { findMany: jest.fn(async () => rules) },
  };
  const assert = (startsAt: Date, durationMin: number) =>
    assertWithinAvailability(prisma, startsAt, durationMin);
  return { assert };
}

describe('BookingService.assertWithinAvailability — rules.some vs rules.every', () => {
  // Понедельник, окно 10:00-19:00 МСК.
  const MATCHING = {
    id: 1,
    dayOfWeek: 1,
    startHour: 10,
    startMinute: 0,
    endHour: 19,
    endMinute: 0,
    timezone: 'Europe/Moscow',
    isActive: true,
  };
  // Другое правило (вторник), которое НИКОГДА не совпадёт со слотом в понедельник.
  const NON_MATCHING = { ...MATCHING, id: 2, dayOfWeek: 2 };

  it('одно из ДВУХ правил подходит → слот разрешён (some, а не every)', async () => {
    const { assert } = makeService([NON_MATCHING, MATCHING]);
    await expect(
      assert(new Date('2026-07-13T09:00:00Z'), 50), // пн 12:00 МСК
    ).resolves.toBeUndefined();
  });

  it('ни одно из правил не подходит → отказ', async () => {
    const { assert } = makeService([NON_MATCHING]);
    await expect(assert(new Date('2026-07-13T09:00:00Z'), 50)).rejects.toThrow(
      'OUTSIDE_AVAILABILITY',
    );
  });
});

describe('BookingService.assertWithinAvailability — арифметика минут (startMinute/endMinute≠0)', () => {
  // Окно 10:30–18:45 МСК (ненулевые минуты — отличает + от - в winStart/winEnd).
  const RULE = {
    id: 1,
    dayOfWeek: 1,
    startHour: 10,
    startMinute: 30,
    endHour: 18,
    endMinute: 45,
    timezone: 'Europe/Moscow',
    isActive: true,
  };

  it('слот в 10:29 МСК (за минуту до открытия) — отказ', async () => {
    const { assert } = makeService([RULE]);
    // 10:29 МСК = 07:29 UTC
    await expect(assert(new Date('2026-07-13T07:29:00Z'), 15)).rejects.toThrow(
      'OUTSIDE_AVAILABILITY',
    );
  });

  it('слот РОВНО в 10:30 МСК (открытие) — разрешён (граница включительно)', async () => {
    const { assert } = makeService([RULE]);
    await expect(
      assert(new Date('2026-07-13T07:30:00Z'), 15),
    ).resolves.toBeUndefined();
  });

  it('сессия заканчивается РОВНО в 18:45 МСК (закрытие) — разрешена (граница включительно)', async () => {
    const { assert } = makeService([RULE]);
    // старт 18:30 МСК + 15 мин = 18:45 МСК, конец окна.
    await expect(
      assert(new Date('2026-07-13T15:30:00Z'), 15),
    ).resolves.toBeUndefined();
  });

  it('сессия заканчивается на 1 минуту позже 18:45 МСК — отказ', async () => {
    const { assert } = makeService([RULE]);
    await expect(assert(new Date('2026-07-13T15:30:00Z'), 16)).rejects.toThrow(
      'OUTSIDE_AVAILABILITY',
    );
  });
});
