// CalDavService — оркестрация push/delete/busy-чтения. Парсинг и discovery
// покрыты в caldav-busy.spec.ts / caldav-discovery.spec.ts (замоканы здесь) —
// фокус на fail-open при сбоях сети, кэше busy-запросов и no-op без учётки.
import { ConfigService } from '@nestjs/config';
import { CalDavService } from './caldav.service';

jest.mock('./caldav-discovery', () => ({
  discoverCalendarUrl: jest.fn(),
  listCalendars: jest.fn(),
}));
jest.mock('./caldav-busy', () => ({
  busyQueryXml: jest.fn(() => '<query/>'),
  parseBusy: jest.fn(() => []),
}));

import { discoverCalendarUrl, listCalendars } from './caldav-discovery';
import { parseBusy } from './caldav-busy';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

function makeService(env: Record<string, string | undefined> = {}) {
  const defaults = { APPLE_ID: 'x@icloud.com', APPLE_APP_PASSWORD: 'pw' };
  const merged = { ...defaults, ...env };
  const config = {
    get: (key: string) => merged[key],
  } as unknown as ConfigService;
  return new CalDavService(config);
}

// REPORT-ответ 207 с телом '<xml/>' — parseBusy замокан, содержимое не важно.
const reportOk = () =>
  Promise.resolve({
    status: 207,
    ok: true,
    text: () => Promise.resolve('<xml/>'),
  });
const NO_CREDS = { APPLE_ID: undefined, APPLE_APP_PASSWORD: undefined };

describe('CalDavService.enabled — no-op без учётных данных', () => {
  it('без APPLE_ID/APPLE_APP_PASSWORD — enabled:false', () => {
    expect(makeService(NO_CREDS).enabled).toBe(false);
  });

  it('с обоими заданными — enabled:true', () => {
    expect(makeService().enabled).toBe(true);
  });

  it('выключенный сервис: pushEvent/getBusyTimes/removeEvent — безопасный no-op, fetch не вызывается', async () => {
    const svc = makeService(NO_CREDS);
    global.fetch = jest.fn() as any;
    expect(
      await svc.pushEvent({
        uid: 'a',
        startsAt: new Date(),
        durationMin: 50,
        summary: 's',
      }),
    ).toBeNull();
    expect(await svc.getBusyTimes(new Date(), new Date())).toEqual([]);
    await svc.removeEvent('a');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('CalDavService.pushEvent — запись события', () => {
  it('APPLE_CALDAV_URL задан явно — PUT сразу по нему, discovery не вызывается', async () => {
    const svc = makeService({ APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/' });
    global.fetch = jest.fn(() => Promise.resolve({ ok: true })) as any;
    const uid = await svc.pushEvent({
      uid: 'booking-1@x',
      startsAt: new Date('2026-07-13T17:00:00Z'),
      durationMin: 50,
      summary: 'S',
    });
    expect(uid).toBe('booking-1@x');
    expect(discoverCalendarUrl).not.toHaveBeenCalled();
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://p1.icloud.com/cal/booking-1@x.ics');
    expect(init.method).toBe('PUT');
  });

  it('без явного URL — использует discoverCalendarUrl и кэширует результат (второй вызов не переоткрывает discovery)', async () => {
    (discoverCalendarUrl as jest.Mock).mockResolvedValue(
      'https://discovered/cal/',
    );
    const svc = makeService();
    global.fetch = jest.fn(() => Promise.resolve({ ok: true })) as any;
    await svc.pushEvent({
      uid: 'a',
      startsAt: new Date(),
      durationMin: 50,
      summary: 's',
    });
    await svc.pushEvent({
      uid: 'b',
      startsAt: new Date(),
      durationMin: 50,
      summary: 's',
    });
    expect(discoverCalendarUrl).toHaveBeenCalledTimes(1);
  });

  it('discovery не находит календарь (null) — pushEvent возвращает null, не бросает', async () => {
    (discoverCalendarUrl as jest.Mock).mockResolvedValue(null);
    const svc = makeService();
    expect(
      await svc.pushEvent({
        uid: 'a',
        startsAt: new Date(),
        durationMin: 50,
        summary: 's',
      }),
    ).toBeNull();
  });

  it('PUT вернул не-ok — возвращает null, бронь не теряется (ошибка проглатывается)', async () => {
    const svc = makeService({ APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/' });
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve('err'),
      }),
    ) as any;
    const uid = await svc.pushEvent({
      uid: 'a',
      startsAt: new Date(),
      durationMin: 50,
      summary: 's',
    });
    expect(uid).toBeNull();
  });

  it('fetch бросает исключение (сеть недоступна) — перехватывается, возвращает null', async () => {
    const svc = makeService({ APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/' });
    global.fetch = jest.fn(() => {
      throw new Error('ECONNREFUSED');
    }) as any;
    await expect(
      svc.pushEvent({
        uid: 'a',
        startsAt: new Date(),
        durationMin: 50,
        summary: 's',
      }),
    ).resolves.toBeNull();
  });
});

describe('CalDavService.getBusyTimes — fail-open и кэш', () => {
  it('APPLE_CALDAV_URL задан — REPORT уходит на него, listCalendars не вызывается', async () => {
    const svc = makeService({ APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/' });
    global.fetch = jest.fn(reportOk) as any;
    await svc.getBusyTimes(
      new Date('2026-07-13T00:00:00Z'),
      new Date('2026-07-14T00:00:00Z'),
    );
    expect(listCalendars).not.toHaveBeenCalled();
    expect((global.fetch as jest.Mock).mock.calls[0][1].method).toBe('REPORT');
  });

  it('без явного URL — сканирует ВСЕ календари через listCalendars, агрегирует результаты', async () => {
    (listCalendars as jest.Mock).mockResolvedValue([
      { url: 'https://c/a/', name: 'A' },
      { url: 'https://c/b/', name: 'B' },
    ]);
    (parseBusy as jest.Mock)
      .mockReturnValueOnce([{ start: new Date(), end: new Date() }])
      .mockReturnValueOnce([{ start: new Date(), end: new Date() }]);
    const svc = makeService();
    global.fetch = jest.fn(reportOk) as any;
    const busy = await svc.getBusyTimes(new Date(), new Date());
    expect(busy).toHaveLength(2); // из ОБОИХ календарей — иначе встреча в "Work" не заблокирует слот
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('один из календарей падает по сети — fail-open: его вклад [], остальные всё равно агрегируются', async () => {
    (listCalendars as jest.Mock).mockResolvedValue([
      { url: 'https://c/a/', name: 'A' },
      { url: 'https://c/b/', name: 'B' },
    ]);
    (parseBusy as jest.Mock).mockReturnValue([
      { start: new Date(), end: new Date() },
    ]);
    const svc = makeService();
    let call = 0;
    global.fetch = jest.fn(() => {
      call++;
      if (call === 1) throw new Error('timeout');
      return reportOk();
    }) as any;
    const busy = await svc.getBusyTimes(new Date(), new Date());
    expect(busy).toHaveLength(1); // только "b" вернул интервал
  });

  it('REPORT вернул ошибочный статус — trактуется как пусто, не бросает', async () => {
    const svc = makeService({ APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/' });
    global.fetch = jest.fn(() =>
      Promise.resolve({ status: 403, ok: false }),
    ) as any;
    expect(await svc.getBusyTimes(new Date(), new Date())).toEqual([]);
  });

  it('повторный запрос с тем же диапазоном в течение 60с — берётся из кэша, fetch не вызывается снова', async () => {
    const svc = makeService({ APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/' });
    global.fetch = jest.fn(reportOk) as any;
    const from = new Date('2026-07-13T00:00:00Z');
    const to = new Date('2026-07-14T00:00:00Z');
    await svc.getBusyTimes(from, to);
    await svc.getBusyTimes(from, to);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('другой диапазон — кэш не используется, новый REPORT уходит', async () => {
    const svc = makeService({ APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/' });
    global.fetch = jest.fn(reportOk) as any;
    await svc.getBusyTimes(
      new Date('2026-07-13T00:00:00Z'),
      new Date('2026-07-14T00:00:00Z'),
    );
    await svc.getBusyTimes(
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-08-02T00:00:00Z'),
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('CalDavService.removeEvent', () => {
  it('пустой uid — no-op, fetch не вызывается', async () => {
    const svc = makeService({ APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/' });
    global.fetch = jest.fn() as any;
    await svc.removeEvent('');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('вызывает DELETE по корректному URL события', async () => {
    const svc = makeService({ APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/' });
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200 }),
    ) as any;
    await svc.removeEvent('booking-9@x');
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://p1.icloud.com/cal/booking-9@x.ics');
    expect(init.method).toBe('DELETE');
  });

  it('404 (уже удалено) не считается ошибкой — не бросает', async () => {
    const svc = makeService({ APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/' });
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 404 }),
    ) as any;
    await expect(svc.removeEvent('x')).resolves.toBeUndefined();
  });

  it('сетевая ошибка — перехватывается, не бросает наружу', async () => {
    const svc = makeService({ APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/' });
    global.fetch = jest.fn(() => {
      throw new Error('down');
    }) as any;
    await expect(svc.removeEvent('x')).resolves.toBeUndefined();
  });
});

describe('CalDavService.debugCalendars', () => {
  it('выключен — []', async () => {
    const svc = makeService(NO_CREDS);
    expect(await svc.debugCalendars()).toEqual([]);
  });

  it('APPLE_CALDAV_URL задан — возвращает его как единственный элемент', async () => {
    const svc = makeService({ APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/' });
    expect(await svc.debugCalendars()).toEqual(['https://p1.icloud.com/cal/']);
  });

  it('иначе — список имён из listCalendars', async () => {
    (listCalendars as jest.Mock).mockResolvedValue([
      { url: 'u', name: 'Home' },
    ]);
    const svc = makeService();
    expect(await svc.debugCalendars()).toEqual(['Home']);
  });

  it('listCalendars упал — перехватывается, возвращает []', async () => {
    (listCalendars as jest.Mock).mockRejectedValue(new Error('boom'));
    const svc = makeService();
    expect(await svc.debugCalendars()).toEqual([]);
  });
});
