// BookingAdminController — все эндпоинты за x-admin-key, до этого теста без
// покрытия совсем. Приоритет: assertAdminKey реально блокирует неверный/
// отсутствующий ключ на КАЖДОМ эндпоинте (не только на одном как образец),
// и что валидный запрос корректно делегирует нужному сервису с нужными
// аргументами. Стиль — как payment.controller.spec.ts / booking.controller.spec.ts.
import { ForbiddenException } from '@nestjs/common';
import { SessionType } from '@prisma/client';
import { BookingAdminController } from './booking-admin.controller';

const ADMIN_KEY = 'super-secret-key';

function makeController(configOverrides: Record<string, string> = {}) {
  const booking = { confirm: jest.fn(), list: jest.fn() };
  const availability = {
    list: jest.fn(),
    create: jest.fn(),
    setActive: jest.fn(),
    remove: jest.fn(),
  };
  const robokassa = { enabled: true };
  const meeting = {
    status: { zoom: false, zoomVars: {}, staticUrl: false },
  };
  const calDav = {
    enabled: false,
    getBusyTimes: jest.fn(),
    debugCalendars: jest.fn(),
  };
  const pricing = { getOptions: jest.fn(), setPrice: jest.fn() };
  const subs = { getOptions: jest.fn(), setPrice: jest.fn() };
  const configMap: Record<string, string> = {
    ADMIN_BOOKING_KEY: ADMIN_KEY,
    ...configOverrides,
  };
  const config = { get: (k: string) => configMap[k] };
  const controller = new BookingAdminController(
    booking as any,
    availability as any,
    robokassa as any,
    meeting as any,
    calDav as any,
    pricing as any,
    subs as any,
    config as any,
  );
  return {
    controller,
    booking,
    availability,
    robokassa,
    meeting,
    calDav,
    pricing,
    subs,
  };
}

describe('BookingAdminController — граница доступа (x-admin-key) на каждом эндпоинте', () => {
  it.each([
    ['prices', (c: any) => c.prices('wrong')],
    [
      'price',
      (c: any) =>
        c.setPrice({ type: SessionType.INTRO_15, amount: 1 } as any, 'wrong'),
    ],
    ['status', (c: any) => c.status('wrong')],
    ['confirm', (c: any) => c.confirm(1, 'wrong')],
    ['list', (c: any) => c.list('wrong')],
    ['sub-prices', (c: any) => c.subPrices('wrong')],
    [
      'sub-price',
      (c: any) => c.setSubPrice({ period: 'month', amount: 1 } as any, 'wrong'),
    ],
    ['rules (list)', (c: any) => c.listRules('wrong')],
    [
      'rules (create)',
      (c: any) =>
        c.createRule(
          { dayOfWeek: 1, startHour: 9, endHour: 17 } as any,
          'wrong',
        ),
    ],
    [
      'rules (toggle)',
      (c: any) => c.toggleRule(1, { isActive: true } as any, 'wrong'),
    ],
    ['rules (delete)', (c: any) => c.deleteRule(1, 'wrong')],
  ])('%s отклоняет неверный x-admin-key', async (_name, call) => {
    const { controller, booking, availability, pricing, subs } =
      makeController();
    await expect(call(controller)).rejects.toThrow(ForbiddenException);
    expect(booking.confirm).not.toHaveBeenCalled();
    expect(booking.list).not.toHaveBeenCalled();
    expect(availability.create).not.toHaveBeenCalled();
    expect(pricing.setPrice).not.toHaveBeenCalled();
    expect(subs.setPrice).not.toHaveBeenCalled();
  });

  it('пустой сконфигурированный ключ отклоняет всё (env не задан → эндпоинт закрыт, а не открыт)', async () => {
    const { controller } = makeController({ ADMIN_BOOKING_KEY: '' });
    await expect(controller.prices('')).rejects.toThrow(ForbiddenException);
    await expect(controller.prices('anything')).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('BookingAdminController — прайсы', () => {
  it('prices делегирует PricingService.getOptions с валидным ключом', async () => {
    const { controller, pricing } = makeController();
    const options = [{ type: SessionType.INTRO_15, price: 0 }];
    pricing.getOptions.mockResolvedValue(options);
    await expect(controller.prices(ADMIN_KEY)).resolves.toBe(options);
  });

  it('setPrice передаёт type и amount как число в PricingService.setPrice', async () => {
    const { controller, pricing } = makeController();
    const result = await controller.setPrice(
      { type: SessionType.SESSION_50, amount: '3500' as any },
      ADMIN_KEY,
    );
    expect(pricing.setPrice).toHaveBeenCalledWith(SessionType.SESSION_50, 3500);
    expect(result).toEqual({ ok: true });
  });
});

describe('BookingAdminController — sub-prices', () => {
  it('subPrices делегирует SubscriptionService.getOptions с валидным ключом', async () => {
    const { controller, subs } = makeController();
    const options = [{ period: 'month', price: 500 }];
    subs.getOptions.mockResolvedValue(options);
    await expect(controller.subPrices(ADMIN_KEY)).resolves.toBe(options);
  });

  it('setSubPrice приводит период к "month", если пришло что-то не "year"', async () => {
    const { controller, subs } = makeController();
    await controller.setSubPrice(
      { period: 'bogus' as any, amount: 500 },
      ADMIN_KEY,
    );
    expect(subs.setPrice).toHaveBeenCalledWith('month', 500);
  });

  it('setSubPrice сохраняет "year", когда период явно "year"', async () => {
    const { controller, subs } = makeController();
    await controller.setSubPrice({ period: 'year', amount: 5000 }, ADMIN_KEY);
    expect(subs.setPrice).toHaveBeenCalledWith('year', 5000);
  });
});

describe('BookingAdminController.status', () => {
  it('CalDAV выключен — calendarBusyCount/calendarNames не запрашиваются (остаются null/[])', async () => {
    const { controller, calDav } = makeController();
    const status = await controller.status(ADMIN_KEY);
    expect(calDav.getBusyTimes).not.toHaveBeenCalled();
    expect(status.calendarBusyCount).toBeNull();
    expect(status.calendarNames).toEqual([]);
    expect(status.appleCalendar).toBe(false);
  });

  it('CalDAV включен — запрашивает занятость и список календарей за 14 дней', async () => {
    const { controller, calDav } = makeController();
    calDav.enabled = true;
    calDav.getBusyTimes.mockResolvedValue([
      { start: new Date(), end: new Date() },
    ]);
    calDav.debugCalendars.mockResolvedValue(['Основной']);

    const status = await controller.status(ADMIN_KEY);

    expect(calDav.getBusyTimes).toHaveBeenCalledTimes(1);
    expect(status.calendarBusyCount).toBe(1);
    expect(status.calendarNames).toEqual(['Основной']);
    expect(status.appleCalendar).toBe(true);
  });

  it('отражает конфиг robokassaTest/emailFallback из ConfigService', async () => {
    const { controller } = makeController({
      ROBOKASSA_IS_TEST: 'true',
      RESEND_API_KEY: 'k',
      ADMIN_EMAIL: 'a@b.ru',
    });
    const status = await controller.status(ADMIN_KEY);
    expect(status.robokassaTest).toBe(true);
    expect(status.emailFallback).toBe(true);
  });
});

describe('BookingAdminController — брони', () => {
  it('confirm делегирует BookingService.confirm с числовым id', async () => {
    const { controller, booking } = makeController();
    booking.confirm.mockResolvedValue({ ok: true });
    await expect(controller.confirm(7, ADMIN_KEY)).resolves.toEqual({
      ok: true,
    });
    expect(booking.confirm).toHaveBeenCalledWith(7);
  });

  it('list с неизвестным filter откатывается на "upcoming"', async () => {
    const { controller, booking } = makeController();
    booking.list.mockResolvedValue([]);
    await controller.list(ADMIN_KEY, 'garbage');
    expect(booking.list).toHaveBeenCalledWith('upcoming');
  });

  it('list с валидным filter передаёт его как есть', async () => {
    const { controller, booking } = makeController();
    booking.list.mockResolvedValue([]);
    await controller.list(ADMIN_KEY, 'cancelled');
    expect(booking.list).toHaveBeenCalledWith('cancelled');
  });
});

describe('BookingAdminController — правила доступности', () => {
  it('listRules/createRule/toggleRule/deleteRule делегируют AvailabilityService с валидным ключом', async () => {
    const { controller, availability } = makeController();
    availability.list.mockResolvedValue([{ id: 1 }]);
    availability.create.mockResolvedValue({ id: 2 });
    availability.setActive.mockResolvedValue({ id: 1, isActive: false });
    availability.remove.mockResolvedValue({ ok: true });

    await expect(controller.listRules(ADMIN_KEY)).resolves.toEqual([{ id: 1 }]);

    const dto = { dayOfWeek: 1, startHour: 9, endHour: 17 };
    await controller.createRule(dto, ADMIN_KEY);
    expect(availability.create).toHaveBeenCalledWith(dto);

    await controller.toggleRule(1, { isActive: false }, ADMIN_KEY);
    expect(availability.setActive).toHaveBeenCalledWith(1, false);

    await controller.deleteRule(1, ADMIN_KEY);
    expect(availability.remove).toHaveBeenCalledWith(1);
  });
});
