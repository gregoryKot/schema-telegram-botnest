// Аудит 2026-11, S17: публичный GET /api/booking/slots с каждой новой парой
// дат делал новый REPORT в iCloud (кэш — одна запись по ключу окна). Теперь
// одно широкое окно читается раз в 60 с, ответы нарезаются из него.
import { ConfigService } from '@nestjs/config';
import { BUSY_TTL_MS, BusyCache, sliceBusy } from './caldav-busy-cache';
import { CalDavService } from './caldav.service';
import { slotsBusyWindow } from './slot-range';

jest.mock('./caldav-busy', () => ({
  busyQueryXml: jest.fn(() => '<query/>'),
  parseBusy: jest.fn(() => []),
}));
import { parseBusy } from './caldav-busy';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-08T10:00:00Z');
const at = (iso: string) => new Date(iso);
const day = (n: number) =>
  new Date(Date.parse('2026-11-08T00:00:00Z') + n * DAY);

describe('BusyCache — одно широкое окно на все запросы слотов', () => {
  it('10 разных окон внутри окна записи — одно чтение, и оно широкое', async () => {
    const read = jest.fn(async () => []);
    const cache = new BusyCache(read);
    for (let i = 0; i < 10; i++) {
      await cache.get(day(i), new Date(day(i + 7).getTime() - 1), NOW + i);
    }
    expect(read).toHaveBeenCalledTimes(1);
    const win = slotsBusyWindow(NOW);
    expect(read).toHaveBeenCalledWith(win.from, win.to);
  });

  it('ответ — только интервалы, пересекающие запрошенное окно', async () => {
    const inside = {
      start: at('2026-11-10T09:00:00Z'),
      end: at('2026-11-10T10:00:00Z'),
    };
    const across = {
      start: at('2026-11-09T23:30:00Z'),
      end: at('2026-11-10T00:30:00Z'),
    };
    const outside = {
      start: at('2026-11-20T09:00:00Z'),
      end: at('2026-11-20T10:00:00Z'),
    };
    const cache = new BusyCache(async () => [inside, across, outside]);
    const got = await cache.get(day(2), new Date(day(3).getTime() - 1), NOW);
    expect(got).toEqual([inside, across]);
  });

  it('через 60 с окно читается заново', async () => {
    const read = jest.fn(async () => []);
    const cache = new BusyCache(read);
    await cache.get(day(1), day(2), NOW);
    await cache.get(day(1), day(2), NOW + BUSY_TTL_MS - 1);
    expect(read).toHaveBeenCalledTimes(1);
    await cache.get(day(1), day(2), NOW + BUSY_TTL_MS);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('параллельные промахи ждут одно чтение', async () => {
    const read = jest.fn(async () => []);
    const cache = new BusyCache(read);
    await Promise.all(
      [0, 1, 2, 3, 4].map((i) => cache.get(day(i), day(i + 1), NOW)),
    );
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('упавшее чтение не кэшируется — следующий запрос пробует снова', async () => {
    const read = jest
      .fn()
      .mockRejectedValueOnce(new Error('сеть'))
      .mockResolvedValueOnce([]);
    const cache = new BusyCache(read);
    await expect(cache.get(day(1), day(2), NOW)).rejects.toThrow('сеть');
    await expect(cache.get(day(1), day(2), NOW + 1)).resolves.toEqual([]);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('КОНТРОЛЬ: окно вне окна записи (админка, прошлые недели) — точный ключ', async () => {
    const read = jest.fn(async () => []);
    const cache = new BusyCache(read);
    await cache.get(day(-30), day(-23), NOW);
    expect(read).toHaveBeenCalledWith(day(-30), day(-23));
    await cache.get(day(-30), day(-23), NOW + 1);
    expect(read).toHaveBeenCalledTimes(1);
    await cache.get(day(-60), day(-53), NOW + 2);
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe('sliceBusy', () => {
  it('граница не пересечение: событие, кончившееся ровно в начале окна, не попадает', () => {
    const iv = {
      start: at('2026-11-10T08:00:00Z'),
      end: at('2026-11-10T09:00:00Z'),
    };
    expect(
      sliceBusy([iv], at('2026-11-10T09:00:00Z'), at('2026-11-10T10:00:00Z')),
    ).toEqual([]);
  });
});

describe('CalDavService.getBusyTimes — 10 разных окон, один REPORT в iCloud', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('публичные окна из формы записи и перебора дат бьют в один кэш', async () => {
    (parseBusy as jest.Mock).mockReturnValue([]);
    global.fetch = jest.fn(async () => ({
      status: 207,
      ok: true,
      text: async () => '<xml/>',
    })) as never;
    const svc = new CalDavService({
      get: (k: string) =>
        ({
          APPLE_ID: 'x@icloud.com',
          APPLE_APP_PASSWORD: 'pw',
          APPLE_CALDAV_URL: 'https://p1.icloud.com/cal/',
        })[k],
    } as unknown as ConfigService);
    const today = Math.floor(Date.now() / DAY) * DAY;
    for (let i = 0; i < 10; i++) {
      await svc.getBusyTimes(
        new Date(today + i * DAY),
        new Date(today + (i + 14) * DAY - 1),
      );
    }
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
