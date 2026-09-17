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
    expect(makeService({ ROBOKASSA_PASSWORD2: undefined }).enabled).toBe(false);
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

  // Мутанты Stryker на guard-условии `!outSum || !invId || !sigReceived`
  // (LogicalOperator/ConditionalExpression, стр.121) не ловятся простой
  // проверкой «пустой параметр → false», потому что при пустом outSum/invId
  // подставленная в шаблон пустая строка всё равно даёт несовпадающую подпись
  // — итог false что с guard'ом, что без него. Ловим ослабленный guard именно
  // подписью, посчитанной ПОД пустую строку: если guard выпал (весь || стал
  // false, или && вместо ||), код дойдёт до сравнения хешей и ПРИМЕТ такую
  // подпись — а guard обязан отсечь запрос раньше, до всякого сравнения.
  it('пустой OutSum: подпись, посчитанная под пустую строку, всё равно отклоняется guard-ом раньше сравнения хешей', () => {
    const svc = makeService();
    const sigForEmptyOutSum = md5(`:42:${PASS1}`);
    expect(svc.validateSuccess('', '42', sigForEmptyOutSum)).toBe(false);
  });

  it('пустой InvId: подпись, посчитанная под пустую строку, всё равно отклоняется guard-ом раньше сравнения хешей', () => {
    const svc = makeService();
    const sigForEmptyInvId = md5(`100.00::${PASS1}`);
    expect(svc.validateSuccess('100.00', '', sigForEmptyInvId)).toBe(false);
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
    // Явный формат hex-дайджеста: ловит мутацию md5() → всегда "" (стр.179).
    // Если хеш сломан на пустую строку, сигнатура тоже "" и не совпадёт с
    // 32-символьным hex, независимо от того, что она "совпала" с локально
    // посчитанным expected (который брался бы из того же сломанного md5, не
    // будь у него отдельной crypto-реализации в самом тесте).
    expect(p.get('SignatureValue')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('fiscal OFF: подпись = MD5(login:sum:invId:pass1), Receipt отсутствует', () => {
    const svc = makeService({ ROBOKASSA_FISCAL: 'false' });
    const url = new URL(svc.buildPaymentUrl(base));
    const p = url.searchParams;
    expect(p.has('Receipt')).toBe(false);
    const expected = md5(`${LOGIN}:4000.00:7:${PASS1}`);
    expect(p.get('SignatureValue')).toBe(expected);
    expect(p.get('SignatureValue')).toMatch(/^[0-9a-f]{32}$/);
  });

  // Мутанты buildReceipt (стр.197-206: BlockStatement/ObjectLiteral/
  // ArrayDeclaration/MethodExpression/StringLiteral) не задевают предыдущие
  // тесты — те лишь проверяют, что Receipt непустой и участвует в подписи.
  // Здесь разбираем сам Receipt и сверяем его структуру и обрезку имени
  // позиции до 128 символов (Robokassa отклоняет более длинные).
  it('Receipt: структура позиции для Робочеков и обрезка имени до 128 символов', () => {
    const svc = makeService();
    const longDesc = 'Ф'.repeat(150);
    const url = new URL(svc.buildPaymentUrl({ ...base, desc: longDesc }));
    const receiptRaw = url.searchParams.get('Receipt')!;
    // Receipt в URL закодирован дважды: один раз вручную в сервисе
    // (encodeURIComponent перед URLSearchParams), один раз самим
    // URLSearchParams при сборке query string. `.get()` снимает только
    // внешний (URLSearchParams) слой — снимаем оставшийся вручную.
    const receipt = JSON.parse(decodeURIComponent(receiptRaw)) as {
      items: Array<{
        name: string;
        quantity: number;
        sum: number;
        tax: string;
        payment_method: string;
        payment_object: string;
      }>;
    };
    expect(receipt.items).toHaveLength(1);
    const item = receipt.items[0];
    expect(item.name).toBe(longDesc.slice(0, 128));
    expect(item.name.length).toBe(128);
    expect(item.quantity).toBe(1);
    expect(item.sum).toBe(4000);
    expect(item.tax).toBe('none');
    expect(item.payment_method).toBe('full_payment');
    expect(item.payment_object).toBe('service');
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
      new URL(
        svc.buildPaymentUrl({ ...base, recurring: true }),
      ).searchParams.get('Recurring'),
    ).toBe('true');
  });

  it('email прокидывается только когда передан', () => {
    const svc = makeService({ ROBOKASSA_FISCAL: 'false' });
    const withEmail = new URL(svc.buildPaymentUrl({ ...base, email: 'a@b.ru' }))
      .searchParams;
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
    let sentUrl: unknown;
    let sentInit: any;
    global.fetch = jest.fn(async (url: any, init: any) => {
      sentUrl = url;
      sentInit = init;
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
    // Мутанты на URL/method/headers (стр.153-155) не задевают проверки выше
    // (они смотрят только на body) — ловим их отдельно, сверяя реальный
    // Robokassa-эндпоинт и заголовок формы.
    expect(sentUrl).toBe('https://auth.robokassa.ru/Merchant/Recurring');
    expect(sentInit.method).toBe('POST');
    expect(sentInit.headers).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
  });

  it('обрезает пробелы вокруг ответа (trim) перед проверкой "OK"', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => '  OK900123  \n',
    })) as any;
    const svc = makeService();
    const res = await svc.chargeRecurring({
      invId: 1,
      previousInvId: 2,
      amount: 10,
      desc: 'x',
    });
    expect(res.ok).toBe(true);
    expect(res.body).toBe('OK900123');
  });

  it('"OK" должен стоять СТРОГО в начале ответа — если он просто встречается внутри текста, платёж не считается успешным', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => 'ERROR CODE OK',
    })) as any;
    const svc = makeService();
    const res = await svc.chargeRecurring({
      invId: 1,
      previousInvId: 2,
      amount: 10,
      desc: 'x',
    });
    expect(res.ok).toBe(false);
  });

  it('если res.text() падает — тело считается пустой строкой (fallback catch), а не пробрасывается наружу как ошибка', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => {
        throw new Error('stream broken');
      },
    })) as any;
    const svc = makeService();
    const res = await svc.chargeRecurring({
      invId: 1,
      previousInvId: 2,
      amount: 10,
      desc: 'x',
    });
    expect(res.ok).toBe(false);
    // Если бы fallback возвращал undefined вместо '', `.trim()` на undefined
    // бросил бы TypeError, его поймал бы ВНЕШНИЙ catch, и body стало бы
    // текстом ошибки TypeError, а не пустой строкой.
    expect(res.body).toBe('');
  });

  it('успешный ответ не логирует ошибку', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => 'OK1',
    })) as any;
    const svc = makeService();
    const errSpy = jest
      .spyOn((svc as any).logger, 'error')
      .mockImplementation(() => undefined);
    const res = await svc.chargeRecurring({
      invId: 1,
      previousInvId: 2,
      amount: 10,
      desc: 'x',
    });
    expect(res.ok).toBe(true);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('неуспешный ответ логирует ошибку ровно один раз, с обрезкой тела до 200 символов', async () => {
    const bigBody = 'E'.repeat(300);
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 500,
      text: async () => bigBody,
    })) as any;
    const svc = makeService();
    const errSpy = jest
      .spyOn((svc as any).logger, 'error')
      .mockImplementation(() => undefined);
    const res = await svc.chargeRecurring({
      invId: 5,
      previousInvId: 6,
      amount: 10,
      desc: 'x',
    });
    expect(res.ok).toBe(false);
    expect(errSpy).toHaveBeenCalledTimes(1);
    const loggedMsg = errSpy.mock.calls[0][0] as string;
    expect(loggedMsg).toContain('InvId=5');
    expect(loggedMsg).toContain('E'.repeat(200));
    // Полное (необрезанное) тело в лог попадать не должно.
    expect(loggedMsg).not.toContain('E'.repeat(201));
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
    const errSpy = jest
      .spyOn((svc as any).logger, 'error')
      .mockImplementation(() => undefined);
    const res = await svc.chargeRecurring({
      invId: 1,
      previousInvId: 2,
      amount: 100,
      desc: 'x',
    });
    expect(res.ok).toBe(false);
    expect(res.body).toContain('network down');
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0][0]).toContain('network down');
  });
});
