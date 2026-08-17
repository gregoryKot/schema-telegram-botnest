// Щит, волна 2б: DonationController был единственным контроллером с
// маршрутом без собственного спека (docs/SHIELD_PROMPT.md, «Известные
// дыры»). DonationService.create() покрыт отдельно
// (donation.service.create.spec.ts) — здесь проверяется то, что живёт в
// самом контроллере и раньше не проверялось вообще: honeypot, троттлинг,
// и что тело запроса передаётся сервису как есть (без потери/подмены полей).
// Стиль — как booking.controller.spec.ts / payment.controller.spec.ts:
// инстанцируется напрямую, DonationService — фейк-шпион.
import { BadRequestException } from '@nestjs/common';
import { DonationController } from './donation.controller';
import { DonateDto } from './donation.dto';

function makeController() {
  const donation = { create: jest.fn() };
  const controller = new DonationController(donation as any);
  return { controller, donation };
}

const BASE_DTO: DonateDto = {
  amount: 300,
  source: 'app',
  email: 'a@b.co',
  comment: 'спасибо',
};

describe('DonationController.donate — honeypot', () => {
  it('скрытое поле website заполнено → BadRequestException, DonationService.create не вызывается', async () => {
    const { controller, donation } = makeController();
    await expect(
      controller.donate({ ...BASE_DTO, website: 'i-am-a-bot' }),
    ).rejects.toThrow(BadRequestException);
    expect(donation.create).not.toHaveBeenCalled();
  });

  it('website пустая строка — не срабатывает (людям поле не показывается, но пусто ≠ заполнено)', async () => {
    const { controller, donation } = makeController();
    const created = { id: 1, paymentUrl: null };
    donation.create.mockResolvedValue(created);
    const res = await controller.donate({ ...BASE_DTO, website: '' });
    // Не голый toHaveBeenCalledTimes (weak-assert-храповик): донат обязан
    // дойти до сервиса с реальными полями и вернуться наружу без подмены.
    expect(donation.create).toHaveBeenCalledWith({
      amount: 300,
      source: 'app',
      email: 'a@b.co',
      comment: 'спасибо',
    });
    expect(res).toBe(created);
  });
});

describe('DonationController.donate — happy path', () => {
  it('передаёт amount/source/email/comment сервису как есть и возвращает его результат без изменений', async () => {
    const { controller, donation } = makeController();
    const result = {
      id: 42,
      paymentUrl: 'https://auth.robokassa.ru/x?invId=1000000042',
    };
    donation.create.mockResolvedValue(result);

    const res = await controller.donate(BASE_DTO);

    expect(donation.create).toHaveBeenCalledWith({
      amount: 300,
      source: 'app',
      email: 'a@b.co',
      comment: 'спасибо',
    });
    expect(res).toBe(result);
  });

  it('минимальное тело (только amount) — source/email/comment уходят в сервис как undefined, не теряются молча в другое значение', async () => {
    const { controller, donation } = makeController();
    donation.create.mockResolvedValue({ id: 1, paymentUrl: null });

    await controller.donate({ amount: 100 });

    expect(donation.create).toHaveBeenCalledWith({
      amount: 100,
      source: undefined,
      email: undefined,
      comment: undefined,
    });
  });

  // Валидация суммы (мусор/отрицательная/нулевая) — не дело контроллера: DTO
  // проверяет только тип (@IsNumber, donation.dto.spec.ts), диапазон
  // MIN..MAX клампует DonationService.create (donation.service.create.spec.ts).
  // Здесь проверяем контракт контроллера: он не глотает ошибку сервиса и не
  // подменяет её своей — отказ долетает до вызывающего как есть.
  it('DonationService.create отклоняет сумму (диапазон/мусор) — контроллер не глотает ошибку', async () => {
    const { controller, donation } = makeController();
    donation.create.mockRejectedValue(
      new BadRequestException('Сумма должна быть от 10 до 100000 ₽'),
    );

    await expect(
      controller.donate({ ...BASE_DTO, amount: -5 }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('DonationController.donate — троттлинг', () => {
  // Публичный платёжный эндпоинт без auth — троттлинг по IP обязателен
  // (правило CLAUDE.md №5: неверифицированная идентичность бакетируется по
  // IP). Метаданные читаем напрямую, как расставляет @Throttle
  // (@nestjs/throttler) — без поднятия гарда/приложения.
  it('декорирован @Throttle с ограничением по бакету "long" (защита от донат-спама ботом)', () => {
    const limit = Reflect.getMetadata(
      'THROTTLER:LIMITlong',
      DonationController.prototype.donate,
    );
    const ttl = Reflect.getMetadata(
      'THROTTLER:TTLlong',
      DonationController.prototype.donate,
    );
    expect(limit).toBe(20);
    expect(ttl).toBe(3_600_000);
  });
});
