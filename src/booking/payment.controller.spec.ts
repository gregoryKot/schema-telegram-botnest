// TEST_COVERAGE_PLAN.md, этап 3 п.11: PaymentController — единственная точка
// входа реальных денег (Robokassa ResultURL). Контроллер инстанцируется
// напрямую; RobokassaService — настоящий (как в robokassa.service.spec.ts,
// с тестовыми паролями), а не мок — иначе тест не проверял бы саму подпись.
// booking/donation/subscription — фейки-шпионы.
//
// Этот файл — золотая зона mutation-тестирования (stryker.config.json,
// щит-волна 5). Причина: волна 3 (docs/archive/, PR #308) нашла здесь
// ЗЕЛЁНЫЙ тест с утверждением в названии — «ошибка mark-paid доната → FAIL,
// без алерта на этом уровне (алертит сам DonationService)». В
// DonationService не было ни одного try/catch: он алертит на успехе и на
// расхождении суммы, а когда падает сам запрос в БД — молчит. Тест не
// пропускал дыру, а обосновывал её — покрытие было зелёным, а защиты не
// было. Обычный гейт эту разницу не ловит: он умеет проверять, что тест
// СУЩЕСТВУЕТ и ЗЕЛЁНЫЙ, но не умеет отличить верное утверждение от уверенно
// сформулированного неверного. Mutation-тестирование умеет: вырежи алерт
// из кода — тест, который его действительно проверяет, покраснеет. Зона
// покрывает три денежных/алертинговых файла разом (payment.controller.ts,
// donation.service.ts, security-log.service.ts) — там же, где резинка
// зелёного теста рвётся молча.
import { ConflictException, Logger } from '@nestjs/common';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { createHash } from 'crypto';
import { PaymentController } from './payment.controller';
import { PaymentAmountMismatchError } from './booking.service';
import { PaymentAfterCancelError } from './booking.transitions';
import { ConfirmEffectsFailedError } from './booking.confirm-effects';
import { RobokassaService } from './robokassa.service';
import { DONATION_INVID_BASE } from '../donation/donation.service';
import { SUBSCRIPTION_INVID_BASE } from '../subscription/subscription.service';

const PASS1 = 'pass1_secret';
const PASS2 = 'pass2_secret';
const SITE_URL = 'https://kotlarewski.gr';
const APP_URL = 'https://schemehappens.ru';

function md5(s: string): string {
  return createHash('md5').update(s, 'utf8').digest('hex');
}

function makeRobokassa(isTest = true) {
  const map: Record<string, string> = {
    ROBOKASSA_MERCHANT_LOGIN: 'shop_login',
    ROBOKASSA_PASSWORD1: PASS1,
    ROBOKASSA_PASSWORD2: PASS2,
    ROBOKASSA_IS_TEST: isTest ? 'true' : 'false',
  };
  return new RobokassaService({ get: (k: string) => map[k] } as any);
}

function makeController(opts: { liveShop?: boolean } = {}) {
  const robokassa = makeRobokassa(!opts.liveShop);
  const booking = {
    confirm: jest.fn(() => Promise.resolve({ ok: true })),
    getById: jest.fn(() => Promise.resolve({ cancelToken: 'ct-123' })),
  };
  const notify = {
    alertAdmin: jest.fn(() => Promise.resolve(undefined)),
    notifyAdminBoth: jest.fn(() => Promise.resolve(undefined)),
  };
  const donation = {
    markPaidByInvId: jest.fn(() => Promise.resolve({ ok: true })),
  };
  const subscription = {
    markChargePaidByInvId: jest.fn(() => Promise.resolve({ ok: true })),
  };
  const config = {
    get: (k: string) => ({ SITE_URL, APP_URL })[k as 'SITE_URL' | 'APP_URL'],
  };
  const controller = new PaymentController(
    robokassa,
    booking as any,
    notify as any,
    donation as any,
    subscription as any,
    config as any,
  );
  return { controller, robokassa, booking, notify, donation, subscription };
}

function fakeRes() {
  return { redirect: jest.fn() } as any;
}

describe('PaymentController.handleResult — booking (обычный InvId-диапазон)', () => {
  it('валидная подпись → confirm() вызывается, ответ ровно "OK<InvId>"', async () => {
    const { controller, booking } = makeController();
    const outSum = '4000.00';
    const invId = '7';
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await controller.handleResult(outSum, invId, sig);

    expect(res).toBe('OK7');
    expect(booking.confirm).toHaveBeenCalledWith(7, 4000);
  });

  it('неверная подпись → "FAIL<InvId>", confirm() не вызывается (деньги не подтверждаются мимо подписи)', async () => {
    const { controller, booking } = makeController();
    const res = await controller.handleResult('4000.00', '7', 'deadbeef');

    expect(res).toBe('FAIL7');
    expect(booking.confirm).not.toHaveBeenCalled();
  });

  // Ручка публичная и принимает чужие формы: неверная подпись — это сканеры и
  // автосабмиты (аудит 2026-11). Раньше здесь стоял Logger.error(), а каждый
  // error в проде уходит владельцу DM через AlertLogger (main.ts) — мусорный
  // POST будил владельца. Теперь warn со стабильным текстом (по нему серия
  // ищется в логах), error не зовётся вовсе. Шпионы на Logger.prototype:
  // контроллер в юнит-тесте инстанцирован напрямую, без бутстрапа Nest.
  it('неверная подпись → warn с точным, стабильным текстом; error (DM владельцу) не зовётся', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    try {
      const { controller } = makeController();
      await controller.handleResult('4000.00', '7', 'deadbeef');
      expect(warnSpy).toHaveBeenCalledWith(
        'Robokassa webhook: invalid signature',
      );
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('InvId не число → "FAIL" без эха и без обращения к booking (даже с «верной» подписью)', async () => {
    const { controller, booking } = makeController();
    const outSum = '4000.00';
    const invId = 'not-a-number';
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await controller.handleResult(outSum, invId, sig);

    expect(res).toBe('FAIL');
    expect(booking.confirm).not.toHaveBeenCalled();
  });

  // Сервис отвечает {ok:true} на повтор по CONFIRMED и ConflictException не бросает
  // (аудит 2026-10-11) — ветка Conflict в контроллере живёт для остальных
  // статусов без смысла подтверждать, например COMPLETED: поздний повтор.
  it('ConflictException от статуса без смысла подтверждать (COMPLETED) — "OK" без алерта (Robokassa перестаёт ретраить)', async () => {
    const { controller, booking, notify } = makeController();
    booking.confirm.mockRejectedValueOnce(
      new ConflictException('Cannot confirm booking in status COMPLETED'),
    );
    const outSum = '4000.00';
    const invId = '7';
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await controller.handleResult(outSum, invId, sig);

    expect(res).toBe('OK7');
    expect(notify.alertAdmin).not.toHaveBeenCalled();
    expect(notify.notifyAdminBoth).not.toHaveBeenCalled();
  });

  const paidAfterCancel = () =>
    new PaymentAfterCancelError(
      {
        id: 7,
        startsAt: new Date('2026-07-13T17:00:00Z'),
        durationMin: 50,
        type: 'SESSION_50',
        clientName: 'Мария',
        clientContact: '@maria',
        message: null,
        meetingUrl: null,
        cancelToken: 'ct-123',
      } as never,
      4000,
    );

  it('оплата по отменённой/истёкшей брони → владельцу сигнал «деньги получены, а брони нет» в оба канала (бронь, сумма), ответ "OK" (повтор вебхука денег не вернёт)', async () => {
    const { controller, booking, notify } = makeController();
    booking.confirm.mockRejectedValueOnce(paidAfterCancel());
    const outSum = '4000.00';
    const invId = '7';
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await controller.handleResult(outSum, invId, sig);

    expect(res).toBe('OK7');
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
    const [html, subject] = notify.notifyAdminBoth.mock.calls[0] as unknown as [
      { telegram: string; email: string },
      string,
    ];
    expect(html.telegram).toContain('#7');
    expect(html.telegram).toContain('4000 ₽');
    expect(html.telegram).not.toContain('Мария'); // имя — только в письме
    expect(html.email).toContain('Мария');
    expect(subject).toBe('Деньги получены, а брони #7 нет');
    expect(notify.alertAdmin).not.toHaveBeenCalled(); // один сигнал, не два
  });

  it('оплата по отменённой брони логируется warn, а не error: error ушёл бы владельцу вторым DM через AlertLogger', async () => {
    const { controller, booking } = makeController();
    booking.confirm.mockRejectedValueOnce(paidAfterCancel());
    const warn = jest.spyOn(Logger.prototype, 'warn');
    const error = jest.spyOn(Logger.prototype, 'error');
    const outSum = '4000.00';
    const sig = md5(`${outSum}:7:${PASS2}`);

    await controller.handleResult(outSum, '7', sig);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('after cancel'));
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });

  it('сам сигнал владельцу не ушёл (исключение) → "FAIL": Robokassa повторит, повтор оповестит снова', async () => {
    const { controller, booking, notify } = makeController();
    booking.confirm.mockRejectedValueOnce(paidAfterCancel());
    notify.notifyAdminBoth.mockRejectedValueOnce(new Error('tg down'));
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const outSum = '4000.00';
    const sig = md5(`${outSum}:7:${PASS2}`);

    const res = await controller.handleResult(outSum, '7', sig);

    expect(res).toBe('FAIL7');
    error.mockRestore();
  });

  it('расхождение суммы: BookingService.confirm бросает PaymentAmountMismatchError — контроллер отличает его от идемпотентного повтора и отвечает "FAIL" (не подтверждаем деньги, которые не сверились; Robokassa продолжит ретраить, админ уже заалерчен внутри BookingService.confirm)', async () => {
    const { controller, booking, notify } = makeController();
    booking.confirm.mockRejectedValueOnce(
      new PaymentAmountMismatchError('Amount mismatch — manual review'),
    );
    const outSum = '1.00';
    const invId = '7';
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await controller.handleResult(outSum, invId, sig);

    expect(res).toBe('FAIL7');
    // Алерт уже был внутри BookingService.confirm — контроллер не дублирует его.
    expect(notify.alertAdmin).not.toHaveBeenCalled();
  });

  it('реальная (не Conflict) ошибка подтверждения → "FAIL", алертит админа', async () => {
    const { controller, booking, notify } = makeController();
    booking.confirm.mockRejectedValueOnce(new Error('DB down'));
    const outSum = '4000.00';
    const invId = '7';
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await controller.handleResult(outSum, invId, sig);

    expect(res).toBe('FAIL7');
    expect(notify.alertAdmin).toHaveBeenCalledTimes(1);
    expect(notify.alertAdmin.mock.calls[0][0]).toContain('#7');
  });

  // security#21: CAS прошёл — бронь CONFIRMED, не доехали ссылка и календарь.
  // Алерт «не подтвердилась» был ложью, а ответ обязан остаться FAIL: повтор
  // вебхука доделает эффекты.
  it('бронь подтверждена, но эффекты не доехали → "FAIL" и честный алерт «повтор доделает», не «не подтвердилась»; warn, не error', async () => {
    const { controller, booking, notify } = makeController();
    booking.confirm.mockRejectedValueOnce(
      new ConfirmEffectsFailedError(7, new Error('ECONNRESET')),
    );
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const outSum = '4000.00';
    const sig = md5(`${outSum}:7:${PASS2}`);

    const res = await controller.handleResult(outSum, '7', sig);

    expect(res).toBe('FAIL7');
    expect(notify.alertAdmin).toHaveBeenCalledTimes(1);
    const text = String(notify.alertAdmin.mock.calls[0][0]);
    expect(text).toContain('#7');
    expect(text).toContain('оплачена и подтверждена');
    expect(text).toContain('доделает');
    expect(text).not.toContain('не подтвердилась');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('effects pending'),
    );
    expect(error).not.toHaveBeenCalled(); // error ушёл бы владельцу вторым DM
    warn.mockRestore();
    error.mockRestore();
  });
});

describe('PaymentController.handleResult — донаты и подписки делят один вебхук', () => {
  it('InvId в диапазоне доната → маршрутизирует в DonationService, booking.confirm не трогается', async () => {
    const { controller, donation, booking } = makeController();
    const id = DONATION_INVID_BASE + 5;
    const outSum = '500.00';
    const invId = String(id);
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await controller.handleResult(outSum, invId, sig);

    expect(res).toBe(`OK${id}`);
    expect(donation.markPaidByInvId).toHaveBeenCalledWith(id, 500);
    expect(booking.confirm).not.toHaveBeenCalled();
  });

  it('InvId в диапазоне подписки → маршрутизирует в SubscriptionService', async () => {
    const { controller, subscription, booking } = makeController();
    const id = SUBSCRIPTION_INVID_BASE + 5;
    const outSum = '300.00';
    const invId = String(id);
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await controller.handleResult(outSum, invId, sig);

    expect(res).toBe(`OK${id}`);
    expect(subscription.markChargePaidByInvId).toHaveBeenCalledWith(id, 300);
    expect(booking.confirm).not.toHaveBeenCalled();
  });

  it('ошибка mark-paid доната → "FAIL" и алерт админу на этом уровне тоже (не только внутри DonationService)', async () => {
    const { controller, donation, notify } = makeController();
    donation.markPaidByInvId.mockRejectedValueOnce(new Error('boom'));
    const id = DONATION_INVID_BASE + 5;
    const outSum = '500.00';
    const invId = String(id);
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await controller.handleResult(outSum, invId, sig);
    expect(res).toBe(`FAIL${id}`);
    expect(notify.alertAdmin).toHaveBeenCalledTimes(1);
    expect(notify.alertAdmin.mock.calls[0][0]).toContain(String(id));
  });
});

// ── Класс бага, а не два точечных фикса ─────────────────────────────────────
// Один вебхук Robokassa обслуживает три диапазона InvId. До этого фикса
// реальная (не benign) ошибка mark-paid алертила админа только у booking —
// у subscription и donation она молча уходила в this.logger.error и деньги
// «терялись» бесследно (узнавали от человека или из логов хостинга). Таблица
// параметризована по диапазону: если завтра появится четвёртый диапазон и
// забудет алерт — этот тест покраснеет сам, без ручной дописки it().
describe('PaymentController.handleResult — деньги не немые ни в одном из трёх диапазонов', () => {
  const RANGES: Array<{
    name: string;
    invId: number;
    mockReject: (m: ReturnType<typeof makeController>, err: Error) => void;
  }> = [
    {
      name: 'booking',
      invId: 7,
      mockReject: (m, err) => m.booking.confirm.mockRejectedValueOnce(err),
    },
    {
      name: 'subscription',
      invId: SUBSCRIPTION_INVID_BASE + 5,
      mockReject: (m, err) =>
        m.subscription.markChargePaidByInvId.mockRejectedValueOnce(err),
    },
    {
      name: 'donation',
      invId: DONATION_INVID_BASE + 5,
      mockReject: (m, err) =>
        m.donation.markPaidByInvId.mockRejectedValueOnce(err),
    },
  ];

  it.each(RANGES)(
    '$name: реальная ошибка mark-paid → алерт админу + "FAIL<InvId>" (Robokassa повторит)',
    async ({ invId, mockReject }) => {
      const m = makeController();
      mockReject(m, new Error('DB down'));
      const outSum = '500.00';
      const sig = md5(`${outSum}:${invId}:${PASS2}`);

      const res = await m.controller.handleResult(outSum, String(invId), sig);

      expect(res).toBe(`FAIL${invId}`);
      expect(m.notify.alertAdmin).toHaveBeenCalledTimes(1);
      expect(m.notify.alertAdmin.mock.calls[0][0]).toContain(String(invId));
    },
  );

  // Контрольный случай для той же таблицы: benign-повтор на booking-диапазоне
  // обязан остаться тихим. Без этого теста имплементация «алертить на любую
  // ошибку без разбора» тоже прошла бы it.each выше.
  it('booking: ConflictException (поздний повтор) — OK без алерта, это НЕ та же ошибка', async () => {
    const m = makeController();
    const invId = 7;
    m.booking.confirm.mockRejectedValueOnce(
      new ConflictException('Cannot confirm booking in status COMPLETED'),
    );
    const outSum = '4000.00';
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await m.controller.handleResult(outSum, String(invId), sig);

    expect(res).toBe(`OK${invId}`);
    expect(m.notify.alertAdmin).not.toHaveBeenCalled();
  });
});

describe('PaymentController.successRedirect', () => {
  it('валидная подпись + booking → редирект на страницу подтверждения с cancelToken', async () => {
    const { controller, booking } = makeController();
    const outSum = '4000.00';
    const invId = '7';
    const sig = md5(`${outSum}:${invId}:${PASS1}`);
    const res = fakeRes();

    await controller.successRedirect(invId, outSum, sig, res);

    expect(booking.getById).toHaveBeenCalledWith(7);
    expect(res.redirect).toHaveBeenCalledWith(
      `${SITE_URL}/booking/paid?token=ct-123`,
    );
  });

  it('неверная подпись — нельзя доверять InvId, редирект на общую страницу без токена', async () => {
    const { controller, booking } = makeController();
    const res = fakeRes();

    await controller.successRedirect('7', '4000.00', 'deadbeef', res);

    expect(booking.getById).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(`${SITE_URL}/booking/paid`);
  });

  // Аудит 2026-11, R9: SignatureValue=a&SignatureValue=b в query — массив;
  // сверка звала `.toLowerCase` у массива и роняла редирект 500.
  it('подпись массивом (повтор параметра в query) → общая страница, не 500', async () => {
    const { controller, booking } = makeController();
    const sig = md5(`4000.00:7:${PASS1}`);
    const res = fakeRes();

    await controller.successRedirect('7', '4000.00', [sig, sig] as never, res);

    expect(booking.getById).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(`${SITE_URL}/booking/paid`);
  });

  it('booking.getById падает (не найдено) → общая страница без токена, не 500', async () => {
    const { controller, booking } = makeController();
    booking.getById.mockRejectedValueOnce(new Error('not found'));
    const outSum = '4000.00';
    const invId = '7';
    const sig = md5(`${outSum}:${invId}:${PASS1}`);
    const res = fakeRes();

    await controller.successRedirect(invId, outSum, sig, res);

    expect(res.redirect).toHaveBeenCalledWith(`${SITE_URL}/booking/paid`);
  });

  it('InvId доната → редирект на /donate?donation=ok, booking не трогается', async () => {
    const { controller, booking } = makeController();
    const id = DONATION_INVID_BASE + 5;
    const outSum = '500.00';
    const invId = String(id);
    const sig = md5(`${outSum}:${invId}:${PASS1}`);
    const res = fakeRes();

    await controller.successRedirect(invId, outSum, sig, res);

    expect(res.redirect).toHaveBeenCalledWith(`${APP_URL}/donate?donation=ok`);
    expect(booking.getById).not.toHaveBeenCalled();
  });

  it('InvId подписки → редирект на /subscribe?sub=ok', async () => {
    const { controller } = makeController();
    const id = SUBSCRIPTION_INVID_BASE + 5;
    const outSum = '300.00';
    const invId = String(id);
    const sig = md5(`${outSum}:${invId}:${PASS1}`);
    const res = fakeRes();

    await controller.successRedirect(invId, outSum, sig, res);

    expect(res.redirect).toHaveBeenCalledWith(`${APP_URL}/subscribe?sub=ok`);
  });
});

describe('PaymentController.failRedirect', () => {
  it('обычная бронь → /booking/paid?fail=1', () => {
    const { controller } = makeController();
    const res = fakeRes();
    controller.failRedirect('7', res);
    expect(res.redirect).toHaveBeenCalledWith(
      `${SITE_URL}/booking/paid?fail=1`,
    );
  });

  it('донат → /donate?donation=fail', () => {
    const { controller } = makeController();
    const res = fakeRes();
    controller.failRedirect(String(DONATION_INVID_BASE + 5), res);
    expect(res.redirect).toHaveBeenCalledWith(
      `${APP_URL}/donate?donation=fail`,
    );
  });

  it('подписка → /subscribe?sub=fail', () => {
    const { controller } = makeController();
    const res = fakeRes();
    controller.failRedirect(String(SUBSCRIPTION_INVID_BASE + 5), res);
    expect(res.redirect).toHaveBeenCalledWith(`${APP_URL}/subscribe?sub=fail`);
  });

  it('InvId не число → тоже общая страница, не падает', () => {
    const { controller } = makeController();
    const res = fakeRes();
    controller.failRedirect('garbage', res);
    expect(res.redirect).toHaveBeenCalledWith(
      `${SITE_URL}/booking/paid?fail=1`,
    );
  });
});

// Отражённая разметка (аудит 2026-11, P2): ответ шёл как text/html с InvId
// эхом, а ручка принимает form-urlencoded без CSRF — чужой сайт автосабмитом
// формы показывал свою разметку с адреса schemehappens.ru.
describe('PaymentController.handleResult — ответ не отражает ввод', () => {
  const EVIL = '<meta http-equiv=refresh content="0;url=https://evil">';

  it('вредный InvId не попадает в ответ: "FAIL" без эха, booking не трогается, warn без error', async () => {
    const { controller, booking } = makeController();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    try {
      const res = await controller.handleResult('1.00', EVIL, 'deadbeef');
      expect(res).toBe('FAIL');
      expect(res).not.toContain('<');
      expect(booking.confirm).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith('Robokassa webhook: malformed InvId');
      expect(error).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it.each([
    ['число с хвостом', '7<b>'],
    ['пробел впереди', ' 7'],
    ['11 цифр', '12345678901'],
    ['пустая строка', ''],
  ])('InvId «%s» → "FAIL" без эха', async (_name, invId) => {
    const { controller, booking } = makeController();
    const outSum = '4000.00';
    const sig = md5(`${outSum}:${invId}:${PASS2}`);
    await expect(controller.handleResult(outSum, invId, sig)).resolves.toBe(
      'FAIL',
    );
    expect(booking.confirm).not.toHaveBeenCalled();
  });

  it('InvId массивом из формы (InvId[]=7) → "FAIL": не строка — не InvId', async () => {
    const { controller, booking } = makeController();
    const invId: unknown = ['7'];
    const sig = md5(`4000.00:7:${PASS2}`);
    await expect(
      controller.handleResult('4000.00', invId as string, sig),
    ).resolves.toBe('FAIL');
    expect(booking.confirm).not.toHaveBeenCalled();
  });

  it('10 цифр — ещё InvId (диапазон подписок 2e9+): эхом "OK<InvId>"', async () => {
    const { controller, subscription } = makeController();
    const invId = String(SUBSCRIPTION_INVID_BASE + 5);
    const outSum = '500.00';
    const sig = md5(`${outSum}:${invId}:${PASS2}`);
    await expect(controller.handleResult(outSum, invId, sig)).resolves.toBe(
      `OK${invId}`,
    );
    expect(subscription.markChargePaidByInvId).toHaveBeenCalled();
  });

  it('числовой InvId по-прежнему эхом: "OK<id>" на верной подписи, "FAIL<id>" на неверной', async () => {
    const { controller } = makeController();
    const sig = md5(`4000.00:42:${PASS2}`);
    await expect(controller.handleResult('4000.00', '42', sig)).resolves.toBe(
      'OK42',
    );
    await expect(
      controller.handleResult('4000.00', '42', 'deadbeef'),
    ).resolves.toBe('FAIL42');
  });

  // @Header Nest пишет в метаданные метода; RouterResponseController ставит
  // заголовок до res.send — express тогда не подменяет его на text/html.
  // Живой HTTP-контракт — test/login-csrf.e2e-spec.ts.
  it('ответ ручки объявлен text/plain; charset=utf-8 (метаданные @Header)', () => {
    const headers = Reflect.getMetadata(
      HEADERS_METADATA,
      PaymentController.prototype.handleResult,
    ) as { name: string; value: string }[];
    expect(headers).toEqual([
      { name: 'Content-Type', value: 'text/plain; charset=utf-8' },
    ]);
  });
});

// Тестовый платёж на боевом магазине (аудит 2026-11, P1 при условии): IsTest
// стоит в ссылке оплаты вне подписи. Если тестовые пароли в кабинете совпадают
// с боевыми, клиент меняет IsTest=0→1, платит тестовой картой — и бронь,
// донат, подписка подтверждались без денег.
describe('PaymentController.handleResult — IsTest=1 на боевом магазине', () => {
  const OUT = '4000.00';
  const signed = (invId: string) => md5(`${OUT}:${invId}:${PASS2}`);

  it.each([
    ['бронь', '7'],
    ['донат', String(DONATION_INVID_BASE + 1)],
    ['подписка', String(SUBSCRIPTION_INVID_BASE + 1)],
  ])(
    '%s: не подтверждается, владельцу алерт, ответ "OK<InvId>" (повтор не нужен)',
    async (_name, invId) => {
      const { controller, booking, donation, subscription, notify } =
        makeController({ liveShop: true });
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      try {
        const res = await controller.handleResult(
          OUT,
          invId,
          signed(invId),
          '1',
        );
        expect(res).toBe(`OK${invId}`);
        expect(booking.confirm).not.toHaveBeenCalled();
        expect(donation.markPaidByInvId).not.toHaveBeenCalled();
        expect(subscription.markChargePaidByInvId).not.toHaveBeenCalled();
        expect(notify.alertAdmin).toHaveBeenCalledTimes(1);
        const [text] = notify.alertAdmin.mock.calls[0] as unknown as [string];
        expect(text).toContain(
          `Тестовый платёж Robokassa на боевом магазине (InvId ${invId}) — не подтверждён`,
        );
        expect(text).toContain('тестовые пароли отличаются от боевых');
        expect(error).not.toHaveBeenCalled(); // второй DM через AlertLogger
      } finally {
        error.mockRestore();
      }
    },
  );

  it('IsTest=1 с неверной подписью на боевом — "FAIL<InvId>", алерта нет (мусор не будит владельца)', async () => {
    const { controller, booking, notify } = makeController({ liveShop: true });
    const res = await controller.handleResult(OUT, '7', 'deadbeef', '1');
    expect(res).toBe('FAIL7');
    expect(booking.confirm).not.toHaveBeenCalled();
    expect(notify.alertAdmin).not.toHaveBeenCalled();
  });

  it.each([
    ['IsTest=0', '0'],
    ['без IsTest', undefined],
  ])(
    'боевой магазин, %s → подтверждается как обычно',
    async (_name, isTest) => {
      const { controller, booking, notify } = makeController({
        liveShop: true,
      });
      const res = await controller.handleResult(OUT, '7', signed('7'), isTest);
      expect(res).toBe('OK7');
      expect(booking.confirm).toHaveBeenCalledWith(7, 4000);
      expect(notify.alertAdmin).not.toHaveBeenCalled();
    },
  );

  it('тестовый магазин (ROBOKASSA_IS_TEST=true), IsTest=1 → подтверждается как обычно, без алерта', async () => {
    const { controller, booking, notify } = makeController();
    const res = await controller.handleResult(OUT, '7', signed('7'), '1');
    expect(res).toBe('OK7');
    expect(booking.confirm).toHaveBeenCalledWith(7, 4000);
    expect(notify.alertAdmin).not.toHaveBeenCalled();
  });
});
