// TEST_COVERAGE_PLAN.md, этап 3 п.11: PaymentController — единственная точка
// входа реальных денег (Robokassa ResultURL). Контроллер инстанцируется
// напрямую; RobokassaService — настоящий (как в robokassa.service.spec.ts,
// с тестовыми паролями), а не мок — иначе тест не проверял бы саму подпись.
// booking/donation/subscription — фейки-шпионы.
import { ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PaymentController } from './payment.controller';
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

function makeRobokassa() {
  const map: Record<string, string> = {
    ROBOKASSA_MERCHANT_LOGIN: 'shop_login',
    ROBOKASSA_PASSWORD1: PASS1,
    ROBOKASSA_PASSWORD2: PASS2,
    ROBOKASSA_IS_TEST: 'true',
  };
  return new RobokassaService({ get: (k: string) => map[k] } as any);
}

function makeController() {
  const robokassa = makeRobokassa();
  const booking = {
    confirm: jest.fn(() => Promise.resolve({ ok: true })),
    getById: jest.fn(() => Promise.resolve({ cancelToken: 'ct-123' })),
  };
  const notify = { alertAdmin: jest.fn(() => Promise.resolve(undefined)) };
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

  it('InvId не число → "FAIL<InvId>" без обращения к booking', async () => {
    const { controller, booking } = makeController();
    const outSum = '4000.00';
    const invId = 'not-a-number';
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await controller.handleResult(outSum, invId, sig);

    expect(res).toBe(`FAILnot-a-number`);
    expect(booking.confirm).not.toHaveBeenCalled();
  });

  it('повторный (replay) callback по уже подтверждённой брони — confirm() бросает ConflictException, контроллер всё равно отвечает "OK" (идемпотентный ack, Robokassa перестаёт ретраить)', async () => {
    const { controller, booking } = makeController();
    booking.confirm.mockRejectedValueOnce(
      new ConflictException('Cannot confirm booking in status CONFIRMED'),
    );
    const outSum = '4000.00';
    const invId = '7';
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await controller.handleResult(outSum, invId, sig);

    expect(res).toBe('OK7');
  });

  it('расхождение суммы: BookingService.confirm тоже бросает ConflictException — контроллер НЕ отличает его от идемпотентного повтора и так же отвечает "OK" (реальная брoнь остаётся неподтверждённой, но админ уже заалерчен внутри BookingService.confirm)', async () => {
    const { controller, booking } = makeController();
    booking.confirm.mockRejectedValueOnce(
      new ConflictException('Amount mismatch — manual review'),
    );
    const outSum = '1.00';
    const invId = '7';
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await controller.handleResult(outSum, invId, sig);

    expect(res).toBe('OK7'); // контроллер не различает эти два ConflictException
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

  it('ошибка mark-paid доната → "FAIL", без алерта на этом уровне (алертит сам DonationService)', async () => {
    const { controller, donation } = makeController();
    donation.markPaidByInvId.mockRejectedValueOnce(new Error('boom'));
    const id = DONATION_INVID_BASE + 5;
    const outSum = '500.00';
    const invId = String(id);
    const sig = md5(`${outSum}:${invId}:${PASS2}`);

    const res = await controller.handleResult(outSum, invId, sig);
    expect(res).toBe(`FAIL${id}`);
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
