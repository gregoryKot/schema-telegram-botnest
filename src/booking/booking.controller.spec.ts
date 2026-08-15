// BookingController — публичные (анонимные) эндпоинты бронирования, до этого
// теста без покрытия совсем. Инстанцируется напрямую, зависимости —
// шпионы/фейки (стиль payment.controller.spec.ts). Проверяем реальную сборку
// CreateBookingDto из BookDto (дефолты, trim, BigInt), honeypot и то, что
// контроллер возвращает результат сервиса как есть, а не подделывает его.
import { BadRequestException } from '@nestjs/common';
import { SessionType } from '@prisma/client';
import { BookingController } from './booking.controller';

function makeController() {
  const slots = { getSlots: jest.fn() };
  const booking = {
    book: jest.fn(),
    getPublicByToken: jest.fn(),
    cancel: jest.fn(),
  };
  const pricing = { getOptions: jest.fn() };
  const controller = new BookingController(
    slots as any,
    booking as any,
    pricing as any,
  );
  return { controller, slots, booking, pricing };
}

const BASE_DTO = {
  startsAt: '2026-08-10T10:00:00.000Z',
  clientName: 'Иван',
  clientContact: '+79990000000',
  acceptedOffer: true,
};

describe('BookingController.getOptions', () => {
  it('возвращает результат PricingService.getOptions как есть', async () => {
    const { controller, pricing } = makeController();
    const options = [{ type: SessionType.INTRO_15, price: 0 }];
    pricing.getOptions.mockReturnValue(options);
    expect(controller.getOptions()).toBe(options);
  });
});

describe('BookingController.getSlots', () => {
  it('без from/to — from по умолчанию "сейчас", to = from + 14 дней', async () => {
    const { controller, slots } = makeController();
    slots.getSlots.mockResolvedValue([]);
    await controller.getSlots(undefined as any, undefined as any);

    const [fromArg, toArg] = slots.getSlots.mock.calls[0];
    const diffDays = (toArg.getTime() - fromArg.getTime()) / 86_400_000;
    expect(diffDays).toBeCloseTo(14, 5);
  });

  it('с явными from/to — передаёт их как Date дальше без искажения', async () => {
    const { controller, slots } = makeController();
    slots.getSlots.mockResolvedValue([]);
    await controller.getSlots('2026-08-01', '2026-08-05');

    const [fromArg, toArg] = slots.getSlots.mock.calls[0];
    expect(fromArg.toISOString().slice(0, 10)).toBe('2026-08-01');
    expect(toArg.toISOString().slice(0, 10)).toBe('2026-08-05');
  });

  it('сериализует слоты в ISO-строки и durationMin как есть', async () => {
    const { controller, slots } = makeController();
    slots.getSlots.mockResolvedValue([
      {
        startsAt: new Date('2026-08-01T10:00:00Z'),
        endsAt: new Date('2026-08-01T10:50:00Z'),
        durationMin: 50,
      },
    ]);
    const result = await controller.getSlots('2026-08-01', '2026-08-02');
    expect(result).toEqual([
      {
        startsAt: '2026-08-01T10:00:00.000Z',
        endsAt: '2026-08-01T10:50:00.000Z',
        durationMin: 50,
      },
    ]);
  });

  it('кривой from → BadRequestException (400), а не Invalid Date → Prisma 500 (L11)', async () => {
    const { controller, slots } = makeController();
    await expect(
      controller.getSlots('not-a-date', '2026-08-05'),
    ).rejects.toThrow(BadRequestException);
    // Падаем ДО обращения к БД — 400 вместо 500.
    expect(slots.getSlots).not.toHaveBeenCalled();
  });

  it('кривой to (синтаксически похож, но невалиден) → BadRequestException, БД не трогаем (L11)', async () => {
    const { controller, slots } = makeController();
    await expect(
      controller.getSlots('2026-08-01', '2026-13-45'),
    ).rejects.toThrow(BadRequestException);
    expect(slots.getSlots).not.toHaveBeenCalled();
  });

  it('гигантский диапазон → BadRequestException, перебор по суткам не запускается (D1 DoS)', async () => {
    const { controller, slots } = makeController();
    await expect(
      controller.getSlots('2000-01-01', '9999-12-31'),
    ).rejects.toThrow(BadRequestException);
    // Ключевое: НЕ доходим до getSlots — event-loop не блокируется.
    expect(slots.getSlots).not.toHaveBeenCalled();
  });

  it('диапазон в пределах 92 дней проходит к сервису с теми же датами', async () => {
    const { controller, slots } = makeController();
    slots.getSlots.mockResolvedValue([]);
    await controller.getSlots('2026-08-01', '2026-10-01'); // ~61 день
    const [fromArg, toArg] = slots.getSlots.mock.calls[0];
    expect(fromArg.toISOString().slice(0, 10)).toBe('2026-08-01');
    expect(toArg.toISOString().slice(0, 10)).toBe('2026-10-01');
  });
});

describe('BookingController.bookSlot', () => {
  it('honeypot заполнен → BadRequestException, BookingService.book не вызывается', async () => {
    const { controller, booking } = makeController();
    await expect(
      controller.bookSlot({ ...BASE_DTO, website: 'i-am-a-bot' }),
    ).rejects.toThrow(BadRequestException);
    expect(booking.book).not.toHaveBeenCalled();
  });

  it('собирает CreateBookingDto с дефолтами: durationMin=50, type=INTRO_15, returning/acceptedOffer=false по умолчанию', async () => {
    const { controller, booking } = makeController();
    booking.book.mockResolvedValue({ id: 1 });
    await controller.bookSlot({
      startsAt: BASE_DTO.startsAt,
      clientName: BASE_DTO.clientName,
      clientContact: BASE_DTO.clientContact,
      acceptedOffer: true,
    });

    const dto = booking.book.mock.calls[0][0];
    expect(dto.durationMin).toBe(50);
    expect(dto.type).toBe(SessionType.INTRO_15);
    expect(dto.returning).toBe(false);
    expect(dto.acceptedOffer).toBe(true);
    expect(dto.startsAt).toEqual(new Date(BASE_DTO.startsAt));
  });

  it('обрезает пробелы у clientName/clientContact/message/source', async () => {
    const { controller, booking } = makeController();
    booking.book.mockResolvedValue({ id: 1 });
    await controller.bookSlot({
      ...BASE_DTO,
      clientName: '  Иван  ',
      clientContact: '  +79990000000  ',
      message: '  привет  ',
      source: '  /booking?ref=vk  ',
    });

    const dto = booking.book.mock.calls[0][0];
    expect(dto.clientName).toBe('Иван');
    expect(dto.clientContact).toBe('+79990000000');
    expect(dto.message).toBe('привет');
    expect(dto.source).toBe('/booking?ref=vk');
  });

  it('пустой source после trim становится undefined, а не пустой строкой', async () => {
    const { controller, booking } = makeController();
    booking.book.mockResolvedValue({ id: 1 });
    await controller.bookSlot({ ...BASE_DTO, source: '   ' });
    expect(booking.book.mock.calls[0][0].source).toBeUndefined();
  });

  it('clientTelegramId переводится в BigInt', async () => {
    const { controller, booking } = makeController();
    booking.book.mockResolvedValue({ id: 1 });
    await controller.bookSlot({
      ...BASE_DTO,
      clientTelegramId: 123456,
    });
    expect(booking.book.mock.calls[0][0].clientTelegramId).toBe(123456n);
  });

  it('возвращает результат BookingService.book как есть', async () => {
    const { controller, booking } = makeController();
    const result = { id: 5, cancelToken: 'tok', status: 'CONFIRMED' };
    booking.book.mockResolvedValue(result);
    await expect(controller.bookSlot(BASE_DTO)).resolves.toBe(result);
  });

  it('ошибка BookingService.book (напр. слот занят) пробрасывается наружу', async () => {
    const { controller, booking } = makeController();
    booking.book.mockRejectedValue(new Error('Slot already taken'));
    await expect(controller.bookSlot(BASE_DTO)).rejects.toThrow(
      'Slot already taken',
    );
  });
});

describe('BookingController.getByToken / cancelByToken', () => {
  it('getByToken делегирует BookingService.getPublicByToken и возвращает результат', async () => {
    const { controller, booking } = makeController();
    const view = { status: 'CONFIRMED', type: SessionType.INTRO_15 };
    booking.getPublicByToken.mockResolvedValue(view);
    await expect(controller.getByToken('tok-1')).resolves.toBe(view);
    expect(booking.getPublicByToken).toHaveBeenCalledWith('tok-1');
  });

  it('cancelByToken делегирует BookingService.cancel и возвращает результат', async () => {
    const { controller, booking } = makeController();
    booking.cancel.mockResolvedValue({ ok: true });
    await expect(controller.cancelByToken('tok-1')).resolves.toEqual({
      ok: true,
    });
    expect(booking.cancel).toHaveBeenCalledWith('tok-1');
  });
});
