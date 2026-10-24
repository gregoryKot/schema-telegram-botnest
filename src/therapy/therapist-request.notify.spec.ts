// Телеграм-уведомления заявки на роль терапевта — вынесены из
// therapist-request.service.spec.ts вместе с TherapistRequestNotifyService
// (правило №10 CLAUDE.md — лимит размера файла).
//
// Регрессия на инцидент «заявка на психолога не доходит до бота»: после
// переезда бота (@SchemaLabBot → @SchemeHappensBot) DM админу мог молча
// падать (админ ещё не нажал Start у нового бота), а старый sendTg только
// писал warn в лог — заявка терялась. Фикс: при неудачной доставке в
// Telegram уходит e-mail-фолбэк (notifyAdminWithFallback), покрыто ниже
// в describe('TherapistRequestNotifyService.notifyAdmin — доставка заявки админу').
//
// Регрессия на правило ты/вы (CLAUDE.md «Обращение ты/вы»): notifyApplicant
// раньше писал заявителю только «Твоя заявка…» независимо от выбранной
// формы обращения — пользователь с формой «вы» видел «ты».
import { TherapistRequestNotifyService } from './therapist-request.notify';
import { Logger } from '@nestjs/common';
import { isTelegramUserId } from '../auth/user-id-range';
import * as adminAlert from '../utils/admin-alert';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn(() => Promise.resolve()),
}));

const fallback = adminAlert.notifyAdminWithFallback as jest.Mock;

interface Fixture {
  providers?: Array<{ provider: string; providerId: string; email?: string }>;
  tgIds?: Record<string, bigint>;
}

// Вход по почте: providerId и есть адрес (therapist-request.applicant.ts).
const ANYA = [{ provider: 'email', providerId: 'anya@example.com' }];

function makeFakePrisma(
  addressForm: string | null | undefined,
  fx: Fixture = {},
) {
  return {
    user: {
      findUnique: jest.fn(() => Promise.resolve({ addressForm })),
    },
    authProvider: {
      findMany: jest.fn(() =>
        Promise.resolve(
          (fx.providers ?? []).map((p) => ({ email: null, ...p })),
        ),
      ),
    },
  } as any;
}

function makeService(
  addressForm: string | null | undefined = null,
  fx: Fixture = {},
  prisma: any = makeFakePrisma(addressForm, fx),
) {
  const telegramIdsFor = jest.fn((ids: bigint[]) => {
    const m = new Map<string, bigint>();
    for (const id of ids) {
      const hit = fx.tgIds?.[id.toString()];
      if (hit !== undefined) m.set(id.toString(), hit);
      // Тот же фолбэк, что у AccountService: телеграмный номер — сам себе адрес.
      else if (isTelegramUserId(id)) m.set(id.toString(), id);
    }
    return Promise.resolve(m);
  });
  const email = { send: jest.fn(() => Promise.resolve(true)) };
  const svc = new TherapistRequestNotifyService(
    prisma,
    { telegramIdsFor } as any,
    email as any,
  );
  return { svc, email, telegramIdsFor, prisma };
}

const NOTIFY_REQ = {
  id: 42,
  userId: 123n,
  fullName: 'Мария Иванова',
  qualification: 'Психолог',
  contacts: '@maria',
  message: null,
};

function mockFetchForNotify(ok: boolean, status = ok ? 200 : 403): jest.Mock {
  const fn = jest.fn(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve({ description: ok ? '' : 'blocked' }),
    }),
  );
  global.fetch = fn;
  return fn;
}

describe('TherapistRequestNotifyService.notifyAdmin — доставка заявки админу', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...ORIGINAL_ENV, BOT_TOKEN: 'test-token', ADMIN_ID: '999' };
  });
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('DM админу не прошёл (Telegram 403) → e-mail-фолбэк вызван', async () => {
    mockFetchForNotify(false);
    await makeService().svc.notifyAdmin(NOTIFY_REQ);

    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback.mock.calls[0][0]).toContain('#42');
  });

  it('ADMIN_ID не задан → пуш невозможен, e-mail-фолбэк вызван', async () => {
    delete process.env.ADMIN_ID;
    const fetchMockLocal = mockFetchForNotify(true);
    await makeService().svc.notifyAdmin(NOTIFY_REQ);

    expect(fetchMockLocal).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
    // Тот же контент заявки, что и в остальных сценариях фолбэка — не пустышка.
    expect(fallback.mock.calls[0][0]).toContain('#42');
  });

  it('DM админу прошёл (Telegram ok) → e-mail-фолбэк НЕ нужен', async () => {
    const fetchMockLocal = mockFetchForNotify(true);
    await makeService().svc.notifyAdmin(NOTIFY_REQ);

    expect(fallback).not.toHaveBeenCalled();
    // Успешный путь — DM реально ушёл в Telegram, а не просто «раньше не дошли до фолбэка».
    expect(fetchMockLocal).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMockLocal.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/bottest-token/sendMessage');
    const body = JSON.parse(init.body as string);
    expect(body.chat_id).toBe(999); // ADMIN_ID из process.env в этом describe
    expect(body.text).toContain('#42');
  });

  it('BOT_TOKEN не задан → sendTg не бьёт по сети, сразу e-mail-фолбэк', async () => {
    delete process.env.BOT_TOKEN;
    const fetchMockLocal = jest.fn();
    global.fetch = fetchMockLocal;
    await makeService().svc.notifyAdmin(NOTIFY_REQ);

    expect(fetchMockLocal.mock.calls).toEqual([]);
    expect(fallback.mock.calls).toHaveLength(1);
    expect(fallback.mock.calls[0][0]).toContain('#42');
  });

  it('сетевая ошибка fetch (не HTTP-статус, а reject) → e-mail-фолбэк', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('ECONNRESET')));
    await makeService().svc.notifyAdmin(NOTIFY_REQ);

    expect(fallback.mock.calls).toHaveLength(1);
    expect(fallback.mock.calls[0][0]).toContain('Мария Иванова');
  });

  it('сетевая ошибка fetch НЕ-Error объектом (напр. строкой) — не падает, e-mail-фолбэк', async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- намеренно не-Error reject
    global.fetch = jest.fn(() => Promise.reject('boom-string'));
    await makeService().svc.notifyAdmin(NOTIFY_REQ);

    expect(fallback.mock.calls).toHaveLength(1);
    expect(fallback.mock.calls[0][0]).toContain('#42');
  });

  it('Telegram вернул не-ok без description в теле → фолбэк-текст не падает на undefined', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      }),
    );
    await makeService().svc.notifyAdmin(NOTIFY_REQ);

    // Раз delivered=false — фолбэк всё равно сработал, и текст фолбэка не
    // содержит "undefined" (что случилось бы, интерполируй код отсутствующий
    // err.description напрямую вместо fallback '(no description)').
    expect(fallback.mock.calls).toHaveLength(1);
    expect(fallback.mock.calls[0][0]).not.toContain('undefined');
  });
});

const WEB_ID = 1_000_000_000_000_102n;
const req = (
  userId: bigint,
  decision: 'approved' | 'rejected' = 'approved',
  reason?: string,
) => ({ requestId: 42, userId, decision, reason });

describe('TherapistRequestNotifyService.notifyApplicant — ты/вы по User.addressForm', () => {
  const ORIGINAL_ENV = process.env;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, BOT_TOKEN: 'test-token' };
    fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    global.fetch = fetchMock;
  });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('addressForm: "vy" → approved шлёт «Ваша заявка… Перезапустите…»', async () => {
    await makeService('vy').svc.notifyApplicant(req(1n));

    const [, opts] = fetchMock.mock.calls[0];
    const text = JSON.parse(opts.body).text as string;
    expect(text).toContain('Ваша заявка на роль терапевта одобрена');
    expect(text).toContain('Перезапустите приложение');
    expect(text).not.toMatch(/Твоя|Перезапусти\b/);
  });

  it('addressForm: "vy" → rejected шлёт «Ваша заявка… отклонена»', async () => {
    await makeService('vy').svc.notifyApplicant(
      req(1n, 'rejected', 'Причина X'),
    );

    const [, opts] = fetchMock.mock.calls[0];
    const text = JSON.parse(opts.body).text as string;
    expect(text).toContain('Ваша заявка на роль терапевта отклонена');
    expect(text).toContain('Причина: Причина X');
    expect(text).not.toContain('Твоя');
  });

  it('причина экранируется для parse_mode HTML', async () => {
    await makeService(null).svc.notifyApplicant(
      req(1n, 'rejected', 'нужен <диплом> & опыт'),
    );

    const text = JSON.parse(fetchMock.mock.calls[0][1].body).text as string;
    expect(text).toContain('нужен &lt;диплом&gt; &amp; опыт');
  });

  it('addressForm: null (дефолт) → «Твоя заявка… Перезапусти…»', async () => {
    await makeService(null).svc.notifyApplicant(req(1n));

    const [, opts] = fetchMock.mock.calls[0];
    const text = JSON.parse(opts.body).text as string;
    expect(text).toContain('Твоя заявка на роль терапевта одобрена');
    expect(text).toContain('Перезапусти приложение');
    expect(text).not.toContain('Ваша');
  });

  it('чтение формы (findUnique) падает → уведомление всё равно уходит, с дефолтной формой «ты»', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn(() => Promise.reject(new Error('db down'))),
      },
    } as any;
    await makeService(null, {}, prisma).svc.notifyApplicant(req(1n));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, opts] = fetchMock.mock.calls[0];
    const text = JSON.parse(opts.body).text as string;
    expect(text).toContain('Твоя заявка на роль терапевта одобрена');
  });
});

// Регрессия аудита 2026-10 (X-1 / backend#31): решение уходило в sendMessage с
// chat_id = userId. У веб-аккаунта (Google/почта) userId лежит в веб-диапазоне
// и чатом не является — заявитель с сайта не получал ничего, а в логе была
// одна строка warn. Теперь адрес — из привязки Telegram, запасной канал —
// почта аккаунта, нет ни того ни другого — logger.error (в проде это DM
// владельцу через AlertLogger).
describe('TherapistRequestNotifyService.notifyApplicant — адрес и запасной канал', () => {
  const ORIGINAL_ENV = process.env;
  let fetchMock: jest.Mock;
  let errorSpy: jest.SpyInstance;
  const tgBody = (i = 0) => JSON.parse(fetchMock.mock.calls[i][1].body);

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, BOT_TOKEN: 'test-token' };
    fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    global.fetch = fetchMock;
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('веб-аккаунт без Telegram, со входом по почте → письмо, в Telegram не пишем', async () => {
    const { svc, email } = makeService('vy', { providers: ANYA });
    await svc.notifyApplicant(req(WEB_ID));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(email.send).toHaveBeenCalledTimes(1);
    const [to, subject, text] = email.send.mock.calls[0] as unknown as string[];
    expect(to).toBe('anya@example.com');
    expect(subject).toBe('Заявка на роль терапевта одобрена');
    expect(text).toContain('Ваша заявка на роль терапевта одобрена');
    expect(text).toContain('https://schemehappens.ru/account');
    expect(text).not.toMatch(/Твоя|✅/);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('вход по почте и email из профиля Google тоже дают адрес', async () => {
    const byLogin = makeService(null, {
      providers: [{ provider: 'email', providerId: 'a@example.com' }],
    });
    await byLogin.svc.notifyApplicant(req(WEB_ID));
    expect(byLogin.email.send.mock.calls[0]).toEqual([
      'a@example.com',
      expect.any(String),
      expect.any(String),
    ]);

    const byGoogle = makeService(null, {
      providers: [
        { provider: 'google', providerId: 'sub', email: 'g@example.com' },
      ],
    });
    await byGoogle.svc.notifyApplicant(req(WEB_ID));
    expect(byGoogle.email.send.mock.calls[0][0]).toBe('g@example.com');
  });

  it('веб-аккаунт с привязанным Telegram → chat_id из привязки, а не userId; письма нет', async () => {
    const { svc, email } = makeService(null, {
      tgIds: { [WEB_ID.toString()]: 555n },
      providers: ANYA,
    });
    await svc.notifyApplicant(req(WEB_ID));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(tgBody().chat_id).toBe(555);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('Telegram отказал (chat not found) → письмо на почту', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({ description: 'Bad Request: chat not found' }),
    });
    const { svc, email } = makeService(null, {
      tgIds: { [WEB_ID.toString()]: 555n },
      providers: ANYA,
    });
    await svc.notifyApplicant(req(WEB_ID, 'rejected', 'нужен диплом'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const text = (email.send.mock.calls[0] as unknown as string[])[2];
    expect(text).toContain('отклонена');
    expect(text).toContain('Причина: нужен диплом');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('нет ни чата, ни почты → logger.error с номером заявки, без адресов', async () => {
    const { svc, email } = makeService(null, {});
    await svc.notifyApplicant(req(WEB_ID, 'rejected'));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const msg = errorSpy.mock.calls[0][0] as string;
    expect(msg).toContain('#42');
    expect(msg).toContain('rejected');
    expect(msg).toContain('нет Telegram');
    expect(msg).not.toContain(WEB_ID.toString());
  });

  it('Telegram отказал и письмо бросило → error (заявка #N не доставлена)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ description: 'blocked' }),
    });
    const { svc, email } = makeService(null, {
      tgIds: { [WEB_ID.toString()]: 555n },
      providers: ANYA,
    });
    email.send.mockRejectedValue(new Error('Email delivery failed'));
    await svc.notifyApplicant(req(WEB_ID));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('#42');
    expect(errorSpy.mock.calls[0][0]).not.toContain('anya@example.com');
  });

  it('письмо не принято (send вернул false, например нет RESEND_API_KEY) → error с номером заявки', async () => {
    const { svc, email } = makeService('vy', { providers: ANYA });
    email.send.mockResolvedValue(false);
    await svc.notifyApplicant(req(WEB_ID));

    expect(email.send).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('#42');
    expect(errorSpy.mock.calls[0][0]).toContain('письмо не ушло');
    expect(errorSpy.mock.calls[0][0]).not.toContain('anya@example.com');
  });

  it('id выше 2^53 доходит до базы и карты адресов точным bigint', async () => {
    const big = 2n ** 53n + 1n;
    const { svc, prisma, telegramIdsFor } = makeService('vy', {
      providers: ANYA,
    });
    await svc.notifyApplicant(req(big));

    expect(prisma.user.findUnique.mock.calls[0][0].where.id).toBe(big);
    expect(prisma.authProvider.findMany.mock.calls[0][0].where.userId).toBe(
      big,
    );
    expect(telegramIdsFor.mock.calls[0][0]).toEqual([big]);
  });
});
