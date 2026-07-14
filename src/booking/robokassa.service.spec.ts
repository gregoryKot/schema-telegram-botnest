// Юнит-тесты на подпись/суммы Robokassa (аудит 2026-07, остаток 2а): это
// единственный барьер между «кто-то дёрнул ResultURL руками» и «бронь тихо
// подтвердилась без реальной оплаты». Секреты — фейковые, через ConfigService-мок.
import { createHash } from 'crypto';
import { RobokassaService } from './robokassa.service';

const LOGIN = 'shop_login';
const PASS1 = 'pass1_secret';
const PASS2 = 'pass2_secret';

function md5(s: string): string {
  return createHash('md5').update(s, 'utf8').digest('hex');
}

function makeService(overrides: Record<string, string | undefined> = {}) {
  const map: Record<string, string | undefined> = {
    ROBOKASSA_MERCHANT_LOGIN: LOGIN,
    ROBOKASSA_PASSWORD1: PASS1,
    ROBOKASSA_PASSWORD2: PASS2,
    ROBOKASSA_IS_TEST: 'true',
    ...overrides,
  };
  const config: any = { get: (key: string) => map[key] };
  return new RobokassaService(config);
}

describe('RobokassaService.enabled', () => {
  it('true только когда все три секрета заданы', () => {
    expect(makeService().enabled).toBe(true);
    expect(makeService({ ROBOKASSA_PASSWORD2: undefined }).enabled).toBe(
      false,
    );
    expect(makeService({ ROBOKASSA_MERCHANT_LOGIN: '' }).enabled).toBe(false);
  });
});

describe('RobokassaService.validateWebhook (ResultURL, MD5(OutSum:InvId:Password2))', () => {
  it('корректная подпись принимается', () => {
    const svc = makeService();
    const sig = md5(`100.00:42:${PASS2}`);
    expect(svc.validateWebhook('100.00', '42', sig)).toBe(true);
  });

  it('неверная подпись отклоняется', () => {
    const svc = makeService();
    expect(svc.validateWebhook('100.00', '42', 'deadbeef')).toBe(false);
  });

  it('подпись в другом регистре hex — всё равно принимается (case-insensitive)', () => {
    const svc = makeService();
    const sig = md5(`100.00:42:${PASS2}`).toUpperCase();
    expect(svc.validateWebhook('100.00', '42', sig)).toBe(true);
  });

  it('несовпадение суммы — подпись, посчитанная для другой суммы, отклоняется', () => {
    const svc = makeService();
    const sigFor100 = md5(`100.00:42:${PASS2}`);
    expect(svc.validateWebhook('200.00', '42', sigFor100)).toBe(false);
  });

  it('несовпадение InvId — подпись отклоняется', () => {
    const svc = makeService();
    const sigForInv42 = md5(`100.00:42:${PASS2}`);
    expect(svc.validateWebhook('100.00', '43', sigForInv42)).toBe(false);
  });
});

describe('RobokassaService.validateSuccess (SuccessURL, MD5(OutSum:InvId:Password1))', () => {
  it('корректная подпись принимается', () => {
    const svc = makeService();
    const sig = md5(`100.00:42:${PASS1}`);
    expect(svc.validateSuccess('100.00', '42', sig)).toBe(true);
  });

  it('неверная подпись отклоняется', () => {
    const svc = makeService();
    expect(svc.validateSuccess('100.00', '42', 'deadbeef')).toBe(false);
  });

  it('пустые параметры отклоняются без падения', () => {
    const svc = makeService();
    expect(svc.validateSuccess('', '42', 'x')).toBe(false);
    expect(svc.validateSuccess('100.00', '', 'x')).toBe(false);
    expect(svc.validateSuccess('100.00', '42', '')).toBe(false);
  });
});

describe('RobokassaService.buildPaymentUrl — подпись исходящего платежа', () => {
  const base = {
    invId: 7,
    amount: 4000,
    desc: 'Психологическая сессия',
    successUrl: 'https://schemehappens.ru/api/payment/success',
    failUrl: 'https://schemehappens.ru/api/payment/fail',
  };

  it('fiscal ON (по умолчанию): подпись = MD5(login:sum:invId:Receipt:pass1)', () => {
    const svc = makeService();
    const url = new URL(svc.buildPaymentUrl(base));
    const p = url.searchParams;
    expect(p.get('OutSum')).toBe('4000.00');
    const receipt = p.get('Receipt')!;
    expect(receipt).toBeTruthy();
    const expected = md5(`${LOGIN}:4000.00:7:${receipt}:${PASS1}`);
    expect(p.get('SignatureValue')).toBe(expected);
  });

  it('fiscal OFF: подпись = MD5(login:sum:invId:pass1), Receipt отсутствует', () => {
    const svc = makeService({ ROBOKASSA_FISCAL: 'false' });
    const url = new URL(svc.buildPaymentUrl(base));
    const p = url.searchParams;
    expect(p.has('Receipt')).toBe(false);
    const expected = md5(`${LOGIN}:4000.00:7:${PASS1}`);
    expect(p.get('SignatureValue')).toBe(expected);
  });

  it('Recurring не входит в подпись — сигнатура одна и та же с флагом и без', () => {
    const svc = makeService({ ROBOKASSA_FISCAL: 'false' });
    const sigPlain = new URL(svc.buildPaymentUrl(base)).searchParams.get(
      'SignatureValue',
    );
    const sigRecurring = new URL(
      svc.buildPaymentUrl({ ...base, recurring: true }),
    ).searchParams.get('SignatureValue');
    expect(sigRecurring).toBe(sigPlain);
    expect(
      new URL(svc.buildPaymentUrl({ ...base, recurring: true })).searchParams.get(
        'Recurring',
      ),
    ).toBe('true');
  });

  it('email прокидывается только когда передан', () => {
    const svc = makeService({ ROBOKASSA_FISCAL: 'false' });
    const withEmail = new URL(
      svc.buildPaymentUrl({ ...base, email: 'a@b.ru' }),
    ).searchParams;
    expect(withEmail.get('Email')).toBe('a@b.ru');
    const withoutEmail = new URL(svc.buildPaymentUrl(base)).searchParams;
    expect(withoutEmail.has('Email')).toBe(false);
  });

  it('IsTest отражает ROBOKASSA_IS_TEST', () => {
    const test = new URL(
      makeService({ ROBOKASSA_IS_TEST: 'true' }).buildPaymentUrl(base),
    ).searchParams;
    expect(test.get('IsTest')).toBe('1');
    const prod = new URL(
      makeService({ ROBOKASSA_IS_TEST: 'false' }).buildPaymentUrl(base),
    ).searchParams;
    expect(prod.get('IsTest')).toBe('0');
  });
});

describe('RobokassaService.chargeRecurring — подпись MIT-списания', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('шлёт корректную подпись MD5(login:sum:invId:pass1), PreviousInvoiceID вне подписи', async () => {
    let sentBody = '';
    global.fetch = jest.fn(async (_url: any, init: any) => {
      sentBody = init.body as string;
      return { ok: true, text: async () => 'OK900123' } as any;
    }) as any;
    const svc = makeService();
    const res = await svc.chargeRecurring({
      invId: 900123,
      previousInvId: 900001,
      amount: 500,
      desc: 'Подписка',
    });
    expect(res.ok).toBe(true);
    const sent = new URLSearchParams(sentBody);
    expect(sent.get('PreviousInvoiceID')).toBe('900001');
    const expected = md5(`${LOGIN}:500.00:900123:${PASS1}`);
    expect(sent.get('SignatureValue')).toBe(expected);
  });

  it('ответ без "OK" — ok:false', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => 'ERROR: card declined',
    })) as any;
    const svc = makeService();
    const res = await svc.chargeRecurring({
      invId: 1,
      previousInvId: 2,
      amount: 100,
      desc: 'x',
    });
    expect(res.ok).toBe(false);
  });

  it('сетевая ошибка не бросает исключение наружу — ok:false', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as any;
    const svc = makeService();
    const res = await svc.chargeRecurring({
      invId: 1,
      previousInvId: 2,
      amount: 100,
      desc: 'x',
    });
    expect(res.ok).toBe(false);
    expect(res.body).toContain('network down');
  });
});
