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
const ok = () => ({ status: 207, ok: false, text: async () => '<xml/>' });
const forbidden = () => ({ status: 403, ok: false });
const range = (day: number) => [
  new Date(`2026-09-${day}T00:00:00Z`),
  new Date(`2026-09-${day}T23:00:00Z`),
];

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
    global.fetch = jest.fn(async () => ok()) as any;
    await s.getBusyTimes(...range(18));
    expect(error).not.toHaveBeenCalled();
  });
});
