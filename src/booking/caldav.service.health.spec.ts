// Шов «403 от iCloud → алерт админу»: настоящий CalDavService, настоящий
// readBusy, настоящий трекер — только fetch поддельный. Найдено 2026-09-13
// по логам: 403 жил в warn и был невидим (правило №14 CLAUDE.md).
import { Logger } from '@nestjs/common';
import { CalDavService } from './caldav.service';
import { calDavHealth } from './caldav-health';

const originalFetch = global.fetch;
const env: Record<string, string> = {
  APPLE_ID: 'me@icloud.com',
  APPLE_APP_PASSWORD: 'pass',
  APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/',
};
const svc = () => new CalDavService({ get: (k: string) => env[k] } as any);
// Без APPLE_CALDAV_URL — сервис идёт через auto-discovery (listCalendars),
// именно там жил регресс 2026-09-16: пустой список молчал (правило №14).
const discoveryEnv: Record<string, string> = {
  APPLE_ID: 'me@icloud.com',
  APPLE_APP_PASSWORD: 'pass',
};
const discoverySvc = () =>
  new CalDavService({ get: (k: string) => discoveryEnv[k] } as any);
const disabledSvc = () => new CalDavService({ get: () => undefined } as any);
const ok = () => ({ status: 207, ok: false, text: async () => '<xml/>' });
const forbidden = () => ({ status: 403, ok: false });
const range = (day: number) => [
  new Date(`2026-09-${day}T00:00:00Z`),
  new Date(`2026-09-${day}T23:00:00Z`),
];

const PRINCIPAL_XML = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">
  <d:response><d:propstat><d:prop>
    <d:current-user-principal><d:href>/1/principal/</d:href></d:current-user-principal>
  </d:prop></d:propstat></d:response></d:multistatus>`;
const HOME_XML = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response><d:propstat><d:prop>
    <c:calendar-home-set><d:href>/1/calendars/</d:href></c:calendar-home-set>
  </d:prop></d:propstat></d:response></d:multistatus>`;
const EMPTY_LIST_XML = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"></d:multistatus>`;
// Форма С атрибутами — как реальный iCloud (регресс 2026-09-16).
const ONE_CAL_LIST_XML = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response><d:href>/1/calendars/home/</d:href><d:propstat><d:prop>
    <d:displayname>Home</d:displayname>
    <d:resourcetype><d:collection/><c:calendar xmlns:c="urn:ietf:params:xml:ns:caldav"/></d:resourcetype>
    <c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>
  </d:prop></d:propstat></d:response></d:multistatus>`;

function discoveryFetch(
  ...responses: { status?: number; ok?: boolean; body: string }[]
) {
  let i = 0;
  return jest.fn(() => {
    const r = responses[i++] ?? responses[responses.length - 1];
    return Promise.resolve({
      ok: r.ok ?? true,
      status: r.status ?? 207,
      text: () => Promise.resolve(r.body),
    } as any);
  });
}

describe('CalDavService — здоровье чтения календаря', () => {
  let error: jest.SpyInstance;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    calDavHealth.reset();
    error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    calDavHealth.reset();
  });

  it('403 → один алерт про пароль, повторный 403 — только warn, восстановление — один алерт', async () => {
    const s = svc();
    global.fetch = jest.fn(async () => forbidden()) as any;
    expect(await s.getBusyTimes(...range(14))).toEqual([]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain('APPLE_APP_PASSWORD');
    expect(warn).toHaveBeenCalledWith(
      'CalDAV busy read failed: REPORT 403 for https://p1.icloud.com/cal/',
    );

    await s.getBusyTimes(...range(15)); // другой диапазон — мимо кэша
    expect(error).toHaveBeenCalledTimes(1);
    expect(calDavHealth.snapshot()).toMatchObject({ open: true, failCount: 2 });

    global.fetch = jest.fn(async () => ok()) as any;
    await s.getBusyTimes(...range(16));
    expect(error).toHaveBeenCalledTimes(2);
    expect(String(error.mock.calls[1][0])).toContain('снова читается');
    expect(calDavHealth.snapshot().open).toBe(false);
  });

  it('разовый таймаут — warn без алерта; успех — тишина', async () => {
    const s = svc();
    global.fetch = jest.fn(async () => {
      throw new Error('The operation was aborted due to timeout');
    }) as any;
    await s.getBusyTimes(...range(17));
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('aborted due to timeout'),
    );
    expect(calDavHealth.snapshot()).toMatchObject({
      open: false,
      failCount: 1,
      consecutiveFails: 1,
      lastFailKind: 'timeout',
    });

    global.fetch = jest.fn(async () => ok()) as any;
    await s.getBusyTimes(...range(18));
    expect(error).not.toHaveBeenCalled();
    const snap = calDavHealth.snapshot();
    expect(snap).toMatchObject({ open: false, consecutiveFails: 0 });
    expect(snap.lastOkAt).not.toBeNull();
  });
});

// Регресс 2026-09-16 (PR #491): iCloud реально отвечал, discovery-фильтр не
// матчил <calendar/> с атрибутами → listCalendars() возвращал [] → getBusyUrls
// возвращал [] → старый код молча return [] ДО трекера здоровья. В админке
// было «Apple Calendar: вкл · занято: 0» без единой ошибки.
describe('CalDavService — пустой список календарей (регресс 2026-09-16)', () => {
  let error: jest.SpyInstance;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    calDavHealth.reset();
    error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    calDavHealth.reset();
  });

  it('discovery не находит ни одного календаря — авария, getBusyTimes → [], после появления календаря — восстановление', async () => {
    // 1. Ни одного календаря — открыть аварию сразу (детерминировано, как auth).
    const s1 = discoverySvc();
    global.fetch = discoveryFetch(
      { body: PRINCIPAL_XML },
      { body: HOME_XML },
      { body: EMPTY_LIST_XML },
    ) as any;
    expect(await s1.getBusyTimes(...range(21))).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('список календарей пуст'),
    );
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain(
      'ни один календарь не найден',
    );
    expect(calDavHealth.snapshot()).toMatchObject({
      open: true,
      lastFailKind: 'empty',
    });

    // 2. Новый инстанс (своя discovery-память) находит календарь и читает
    // занятость успешно — та же (глобальная) авария закрывается восстановлением.
    const s2 = discoverySvc();
    global.fetch = discoveryFetch(
      { body: PRINCIPAL_XML },
      { body: HOME_XML },
      { body: ONE_CAL_LIST_XML },
      { body: '<xml/>' }, // REPORT busy — 207, пусто
    ) as any;
    expect(await s2.getBusyTimes(...range(22))).toEqual([]);
    expect(error).toHaveBeenCalledTimes(2);
    expect(String(error.mock.calls[1][0])).toContain('снова читается');
    expect(calDavHealth.snapshot().open).toBe(false);
  });

  it('CalDAV выключен (нет APPLE_ID/APPLE_APP_PASSWORD) — аварии нет, ранний выход', async () => {
    global.fetch = jest.fn() as any; // не должен вызываться вообще
    expect(await disabledSvc().getBusyTimes(...range(23))).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(calDavHealth.snapshot().open).toBe(false);
  });
});
