// BookingCalendarAdminController — за x-admin-key на КАЖДОМ эндпоинте (как
// booking-admin.controller.spec.ts), плюс граничная 400-валидация диапазона
// дат, которую держит сам контроллер (не DTO — DTO проверяет только формат).
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingCalendarAdminController } from './booking-calendar-admin.controller';

const ADMIN_KEY = 'super-secret-key';
const VALID_QUERY = { from: '2026-07-13', to: '2026-07-19' };
const VALID_PATCH = {
  set: [
    {
      startsAt: '2026-07-13T09:00:00.000Z',
      durationMin: 50,
      kind: 'BLOCK' as const,
    },
  ],
};

function makeController(configOverrides: Record<string, string> = {}) {
  const calendar = { getCalendar: jest.fn() };
  const overrides = { apply: jest.fn() };
  const configMap: Record<string, string> = {
    ADMIN_BOOKING_KEY: ADMIN_KEY,
    ...configOverrides,
  };
  const config = { get: (k: string) => configMap[k] };
  const controller = new BookingCalendarAdminController(
    calendar as any,
    overrides as any,
    config as any,
  );
  return { controller, calendar, overrides };
}

describe('BookingCalendarAdminController — граница доступа (x-admin-key) на каждом эндпоинте', () => {
  it.each([
    ['getCalendar', (c: any) => c.getCalendar(VALID_QUERY, 'wrong')],
    ['setOverrides', (c: any) => c.setOverrides(VALID_PATCH, 'wrong')],
  ])(
    '%s отклоняет неверный x-admin-key, сервис не вызван',
    async (_name, call) => {
      const { controller, calendar, overrides } = makeController();
      await expect(call(controller)).rejects.toThrow(ForbiddenException);
      expect(calendar.getCalendar).not.toHaveBeenCalled();
      expect(overrides.apply).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['getCalendar', (c: any) => c.getCalendar(VALID_QUERY, undefined)],
    ['setOverrides', (c: any) => c.setOverrides(VALID_PATCH, undefined)],
  ])('%s отклоняет отсутствующий x-admin-key', async (_name, call) => {
    const { controller, calendar, overrides } = makeController();
    await expect(call(controller)).rejects.toThrow(ForbiddenException);
    expect(calendar.getCalendar).not.toHaveBeenCalled();
    expect(overrides.apply).not.toHaveBeenCalled();
  });

  it('пустой сконфигурированный ключ отклоняет всё (env не задан → эндпоинт закрыт)', async () => {
    const { controller, calendar } = makeController({ ADMIN_BOOKING_KEY: '' });
    await expect(controller.getCalendar(VALID_QUERY, '')).rejects.toThrow(
      ForbiddenException,
    );
    expect(calendar.getCalendar).not.toHaveBeenCalled();
  });
});

describe('BookingCalendarAdminController.getCalendar', () => {
  it('валидный запрос делегирует AdminCalendarService.getCalendar с точными from/to', async () => {
    const { controller, calendar } = makeController();
    const result = { timezone: 'Europe/Moscow', days: [] };
    calendar.getCalendar.mockResolvedValue(result);
    await expect(controller.getCalendar(VALID_QUERY, ADMIN_KEY)).resolves.toBe(
      result,
    );
    expect(calendar.getCalendar).toHaveBeenCalledWith(
      '2026-07-13',
      '2026-07-19',
    );
  });

  it('from > to — 400, сервис не вызван', async () => {
    const { controller, calendar } = makeController();
    await expect(
      controller.getCalendar(
        { from: '2026-07-19', to: '2026-07-13' },
        ADMIN_KEY,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(calendar.getCalendar).not.toHaveBeenCalled();
  });

  it('диапазон больше 35 дней — 400, сервис не вызван', async () => {
    const { controller, calendar } = makeController();
    await expect(
      controller.getCalendar(
        { from: '2026-07-01', to: '2026-08-10' },
        ADMIN_KEY,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(calendar.getCalendar).not.toHaveBeenCalled();
  });

  it('диапазон ровно 35 дней — проходит (граница включительно)', async () => {
    const { controller, calendar } = makeController();
    calendar.getCalendar.mockResolvedValue({ days: [] });
    await expect(
      controller.getCalendar(
        { from: '2026-07-01', to: '2026-08-05' },
        ADMIN_KEY,
      ),
    ).resolves.toEqual({ days: [] });
  });

  it('несуществующий календарный день (2026-02-30) — 400, сервис не вызван', async () => {
    const { controller, calendar } = makeController();
    await expect(
      controller.getCalendar(
        { from: '2026-02-30', to: '2026-03-05' },
        ADMIN_KEY,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(calendar.getCalendar).not.toHaveBeenCalled();
  });
});

describe('BookingCalendarAdminController.setOverrides', () => {
  it('валидный патч делегирует SlotOverrideService.apply, строки ISO превращены в Date', async () => {
    const { controller, overrides } = makeController();
    overrides.apply.mockResolvedValue({ ok: true });
    const patch = {
      set: [
        {
          startsAt: '2026-07-13T09:00:00.000Z',
          durationMin: 50,
          kind: 'BLOCK' as const,
        },
      ],
      clear: ['2026-07-13T10:00:00.000Z'],
    };
    await expect(controller.setOverrides(patch, ADMIN_KEY)).resolves.toEqual({
      ok: true,
    });
    expect(overrides.apply).toHaveBeenCalledWith({
      set: [
        {
          startsAt: new Date('2026-07-13T09:00:00.000Z'),
          durationMin: 50,
          kind: 'BLOCK',
        },
      ],
      clear: [new Date('2026-07-13T10:00:00.000Z')],
    });
  });

  it('пустой патч (ни set, ни clear) — 400, сервис не вызван', async () => {
    const { controller, overrides } = makeController();
    await expect(controller.setOverrides({}, ADMIN_KEY)).rejects.toThrow(
      BadRequestException,
    );
    expect(overrides.apply).not.toHaveBeenCalled();
  });

  it('только clear (без set) — валиден, делегирует с пустым set', async () => {
    const { controller, overrides } = makeController();
    overrides.apply.mockResolvedValue({ ok: true });
    await controller.setOverrides(
      { clear: ['2026-07-13T10:00:00.000Z'] },
      ADMIN_KEY,
    );
    expect(overrides.apply).toHaveBeenCalledWith({
      set: [],
      clear: [new Date('2026-07-13T10:00:00.000Z')],
    });
  });

  it('только set (без clear) — валиден, делегирует с пустым clear', async () => {
    const { controller, overrides } = makeController();
    overrides.apply.mockResolvedValue({ ok: true });
    await controller.setOverrides(VALID_PATCH, ADMIN_KEY);
    expect(overrides.apply).toHaveBeenCalledWith({
      set: [
        {
          startsAt: new Date('2026-07-13T09:00:00.000Z'),
          durationMin: 50,
          kind: 'BLOCK',
        },
      ],
      clear: [],
    });
  });
});
