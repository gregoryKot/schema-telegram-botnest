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
import * as adminAlert from '../utils/admin-alert';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn(() => Promise.resolve()),
}));

const fallback = adminAlert.notifyAdminWithFallback as jest.Mock;

function makeFakePrisma(addressForm: string | null | undefined) {
  return {
    user: {
      findUnique: jest.fn(() => Promise.resolve({ addressForm })),
    },
  } as any;
}

function makeService(addressForm: string | null | undefined = null) {
  return new TherapistRequestNotifyService(makeFakePrisma(addressForm));
}

const NOTIFY_REQ = {
  id: 42,
  userId: 123n,
  fullName: 'Мария Иванова',
  qualification: 'Схема-терапевт',
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
    await makeService().notifyAdmin(NOTIFY_REQ);

    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback.mock.calls[0][0]).toContain('#42');
  });

  it('ADMIN_ID не задан → пуш невозможен, e-mail-фолбэк вызван', async () => {
    delete process.env.ADMIN_ID;
    const fetchMockLocal = mockFetchForNotify(true);
    await makeService().notifyAdmin(NOTIFY_REQ);

    expect(fetchMockLocal).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('DM админу прошёл (Telegram ok) → e-mail-фолбэк НЕ нужен', async () => {
    mockFetchForNotify(true);
    await makeService().notifyAdmin(NOTIFY_REQ);

    expect(fallback).not.toHaveBeenCalled();
  });

  it('BOT_TOKEN не задан → sendTg не бьёт по сети, сразу e-mail-фолбэк', async () => {
    delete process.env.BOT_TOKEN;
    const fetchMockLocal = jest.fn();
    global.fetch = fetchMockLocal;
    await makeService().notifyAdmin(NOTIFY_REQ);

    expect(fetchMockLocal.mock.calls).toEqual([]);
    expect(fallback.mock.calls).toHaveLength(1);
    expect(fallback.mock.calls[0][0]).toContain('#42');
  });

  it('сетевая ошибка fetch (не HTTP-статус, а reject) → e-mail-фолбэк', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('ECONNRESET')));
    await makeService().notifyAdmin(NOTIFY_REQ);

    expect(fallback.mock.calls).toHaveLength(1);
    expect(fallback.mock.calls[0][0]).toContain('Мария Иванова');
  });

  it('сетевая ошибка fetch НЕ-Error объектом (напр. строкой) — не падает, e-mail-фолбэк', async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- намеренно не-Error reject
    global.fetch = jest.fn(() => Promise.reject('boom-string'));
    await makeService().notifyAdmin(NOTIFY_REQ);

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
    await makeService().notifyAdmin(NOTIFY_REQ);

    // Раз delivered=false — фолбэк всё равно сработал, и текст фолбэка не
    // содержит "undefined" (что случилось бы, интерполируй код отсутствующий
    // err.description напрямую вместо fallback '(no description)').
    expect(fallback.mock.calls).toHaveLength(1);
    expect(fallback.mock.calls[0][0]).not.toContain('undefined');
  });
});

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
    await makeService('vy').notifyApplicant(1, 'approved');

    const [, opts] = fetchMock.mock.calls[0];
    const text = JSON.parse(opts.body).text as string;
    expect(text).toContain('Ваша заявка на роль терапевта одобрена');
    expect(text).toContain('Перезапустите приложение');
    expect(text).not.toMatch(/Твоя|Перезапусти\b/);
  });

  it('addressForm: "vy" → rejected шлёт «Ваша заявка… отклонена»', async () => {
    await makeService('vy').notifyApplicant(1, 'rejected', 'Причина X');

    const [, opts] = fetchMock.mock.calls[0];
    const text = JSON.parse(opts.body).text as string;
    expect(text).toContain('Ваша заявка на роль терапевта отклонена');
    expect(text).toContain('Причина: Причина X');
    expect(text).not.toContain('Твоя');
  });

  it('addressForm: null (дефолт) → «Твоя заявка… Перезапусти…»', async () => {
    await makeService(null).notifyApplicant(1, 'approved');

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
    await new TherapistRequestNotifyService(prisma).notifyApplicant(
      1,
      'approved',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, opts] = fetchMock.mock.calls[0];
    const text = JSON.parse(opts.body).text as string;
    expect(text).toContain('Твоя заявка на роль терапевта одобрена');
  });
});
