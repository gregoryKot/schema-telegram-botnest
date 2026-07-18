// Регрессия на инцидент «заявка на психолога не доходит до бота»:
// после переезда бота (@SchemaLabBot → @SchemeHappensBot) DM админу мог
// молча падать (админ ещё не нажал Start у нового бота), а старый sendTg
// только писал warn в лог — заявка терялась. Фикс: при неудачной доставке
// в Telegram уходит e-mail-фолбэк (notifyAdminWithFallback).
import { TherapistRequestService } from './therapist-request.service';
import * as adminAlert from '../utils/admin-alert';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn(() => Promise.resolve()),
}));

const fallback = adminAlert.notifyAdminWithFallback as jest.Mock;

const REQ = {
  id: 42,
  userId: 123n,
  fullName: 'Мария Иванова',
  qualification: 'Схема-терапевт',
  contacts: '@maria',
  message: null,
};

// notifyAdmin — приватный; вызываем через типизированный доступ, без `any`.
type WithNotify = { notifyAdmin: (r: typeof REQ) => Promise<void> };
function makeService(): TherapistRequestService & WithNotify {
  const prisma = {} as never;
  const accountService = {} as never;
  return new TherapistRequestService(
    prisma,
    accountService,
  ) as TherapistRequestService & WithNotify;
}

function mockFetch(ok: boolean, status = ok ? 200 : 403): jest.Mock {
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

describe('TherapistRequestService.notifyAdmin — доставка заявки админу', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...OLD_ENV, BOT_TOKEN: 'test-token', ADMIN_ID: '999' };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('DM админу не прошёл (Telegram 403) → e-mail-фолбэк вызван', async () => {
    mockFetch(false);
    await makeService().notifyAdmin(REQ);

    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback.mock.calls[0][0]).toContain('#42');
  });

  it('ADMIN_ID не задан → пуш невозможен, e-mail-фолбэк вызван', async () => {
    delete process.env.ADMIN_ID;
    const fetchMock = mockFetch(true);
    await makeService().notifyAdmin(REQ);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('DM админу прошёл (Telegram ok) → e-mail-фолбэк НЕ нужен', async () => {
    mockFetch(true);
    await makeService().notifyAdmin(REQ);

    expect(fallback).not.toHaveBeenCalled();
  });
});
