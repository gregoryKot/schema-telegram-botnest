// MeetingService раздаёт персональную ссылку на созвон. Деньги тут не
// напрямую, но провал внешнего вызова (Zoom OAuth/API) НЕ должен ронять
// createMeeting и терять бронь — при сбое обязан быть Jitsi-фолбэк. Это и
// есть ключевой инвариант, который проверяем ниже.
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeetingService, MeetingTarget } from './meeting.service';
import { clientKey, legacyClientKey } from './client-key';
import { isLegacyJitsiRoom } from './meeting-jitsi';
import { decrypt } from '../utils/crypto';

function makeService(env: Record<string, string | undefined> = {}): {
  service: MeetingService;
  prisma: any;
  store: Map<string, any>;
} {
  const store = new Map<string, any>();
  const prisma: any = {
    clientMeeting: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(store.get(where.clientKey) ?? null),
      ),
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(
          where.clientKey.in.map((k: string) => store.get(k)).filter(Boolean),
        ),
      ),
      count: jest.fn(({ where }: any) =>
        Promise.resolve(
          where.clientKey.in.filter((k: string) => store.has(k)).length,
        ),
      ),
      create: jest.fn(({ data }: any) => {
        store.set(data.clientKey, { ...data });
        return Promise.resolve({ ...data });
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = store.get(where.clientKey);
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
      // условная запись, как в Postgres: строка ушла из-под where — count 0
      updateMany: jest.fn(({ where, data }: any) => {
        const row = store.get(where.clientKey);
        if (!row || row.meetingUrl !== where.meetingUrl)
          return Promise.resolve({ count: 0 });
        Object.assign(row, data);
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  const service = new MeetingService(prisma, config);
  return { service, prisma, store };
}

const TARGET: MeetingTarget = {
  id: 1,
  startsAt: new Date('2026-07-13T17:00:00Z'),
  durationMin: 50,
  type: 'SESSION_50',
  clientName: 'Мария',
  clientContact: '@maria',
};

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('MeetingService.status — секреты не светятся, только флаги', () => {
  it('zoom:false когда не все ZOOM_* заданы; staticUrl отражает наличие MEETING_STATIC_URL', () => {
    const { service } = makeService({
      ZOOM_ACCOUNT_ID: 'a',
      ZOOM_CLIENT_ID: 'b',
    });
    expect(service.status.zoom).toBe(false);
    expect(service.status.zoomVars).toEqual({
      accountId: true,
      clientId: true,
      clientSecret: false,
    });
    expect(service.status.staticUrl).toBe(false);
  });

  it('zoom:true когда все три ZOOM_* заданы', () => {
    const { service } = makeService({
      ZOOM_ACCOUNT_ID: 'a',
      ZOOM_CLIENT_ID: 'b',
      ZOOM_CLIENT_SECRET: 'c',
    });
    expect(service.status.zoom).toBe(true);
  });
});

describe('MeetingService.createMeeting — MEETING_STATIC_URL (вырожденный фолбэк)', () => {
  it('всегда возвращает статический URL, Prisma не трогается', async () => {
    const { service, prisma } = makeService({
      MEETING_STATIC_URL: 'https://meet.example.com/room',
    });
    expect(await service.createMeeting(TARGET)).toEqual({
      url: 'https://meet.example.com/room',
      replaced: false,
    });
    expect(prisma.clientMeeting.findUnique).not.toHaveBeenCalled();
  });
});

describe('MeetingService.createMeeting — без Zoom (dev), Jitsi по умолчанию', () => {
  it('новый клиент — создаётся Jitsi-комната, запись в БД', async () => {
    const { service, prisma } = makeService();
    const { url, replaced } = await service.createMeeting(TARGET);
    expect(url).toMatch(/^https:\/\/meet\.jit\.si\/schemehappens-/);
    expect(replaced).toBe(false); // новая комната — не замена прежней
    expect(prisma.clientMeeting.create).toHaveBeenCalledTimes(1);
  });

  it('нормализация контакта: "@Maria" и " maria " дают ОДИН и тот же clientKey', async () => {
    const { service, prisma } = makeService();
    const { url: url1 } = await service.createMeeting({
      ...TARGET,
      clientContact: '@Maria',
    });
    const { url: url2 } = await service.createMeeting({
      ...TARGET,
      clientContact: ' maria ',
    });
    expect(url2).toBe(url1); // тот же ключ → та же существующая запись
    expect(prisma.clientMeeting.create).toHaveBeenCalledTimes(1); // второй раз не создавали
  });

  it('возвращающийся клиент получает ту же ссылку повторно, create не вызывается снова', async () => {
    const { service, prisma } = makeService();
    const { url: first } = await service.createMeeting(TARGET);
    prisma.clientMeeting.create.mockClear();
    const second = await service.createMeeting(TARGET);
    expect(second).toEqual({ url: first, replaced: false });
    expect(prisma.clientMeeting.create).not.toHaveBeenCalled();
  });

  it('hasMeetingForContact: false для нового контакта, true после первого createMeeting', async () => {
    const { service } = makeService();
    expect(await service.hasMeetingForContact('@new')).toBe(false);
    await service.createMeeting({ ...TARGET, clientContact: '@new' });
    expect(await service.hasMeetingForContact('@new')).toBe(true);
  });
});

describe('MeetingService.createMeeting — Zoom включён, успешный путь', () => {
  function mockZoomOk() {
    global.fetch = jest.fn((url: string) => {
      if (url.includes('oauth/token')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'tok' }),
        }) as any;
      }
      if (url.includes('v2/users/me/meetings')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ join_url: 'https://zoom.us/j/123', id: 123 }),
        }) as any;
      }
      throw new Error('unexpected url ' + url);
    }) as any;
  }

  it('новый клиент — создаётся Zoom-встреча, сохраняется zoomMeetingId', async () => {
    mockZoomOk();
    const { service, prisma } = makeService({
      ZOOM_ACCOUNT_ID: 'a',
      ZOOM_CLIENT_ID: 'b',
      ZOOM_CLIENT_SECRET: 'c',
    });
    expect(await service.createMeeting(TARGET)).toEqual({
      url: 'https://zoom.us/j/123',
      replaced: false,
    });
    expect(prisma.clientMeeting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          meetingUrl: 'https://zoom.us/j/123',
          zoomMeetingId: '123',
        }),
      }),
    );
  });

  it('существующая Jitsi-запись обновляется до Zoom ("апгрейд"), меняется meetingUrl+zoomMeetingId', async () => {
    const { service, prisma } = makeService(); // сначала без Zoom → Jitsi
    const { url: jitsiUrl } = await service.createMeeting(TARGET);
    expect(jitsiUrl).toContain('meet.jit.si');

    mockZoomOk();
    const { service: zoomService } = ((): { service: MeetingService } => {
      // Пересоздаём сервис с тем же prisma/store, но с включённым Zoom.
      const config = {
        get: (key: string) =>
          ({
            ZOOM_ACCOUNT_ID: 'a',
            ZOOM_CLIENT_ID: 'b',
            ZOOM_CLIENT_SECRET: 'c',
          })[key],
      } as unknown as ConfigService;
      return { service: new MeetingService(prisma, config) };
    })();

    // Комната клиента сменилась (Jitsi → Zoom): владелец узнаёт из DM.
    expect(await zoomService.createMeeting(TARGET)).toEqual({
      url: 'https://zoom.us/j/123',
      replaced: true,
    });
    expect(prisma.clientMeeting.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { meetingUrl: 'https://zoom.us/j/123', zoomMeetingId: '123' },
      }),
    );
  });
});

describe('MeetingService.createMeeting — Zoom настроен, но внешний вызов падает: бронь НЕ должна теряться', () => {
  const zoomConfig = {
    ZOOM_ACCOUNT_ID: 'a',
    ZOOM_CLIENT_ID: 'b',
    ZOOM_CLIENT_SECRET: 'c',
  };

  it('токен Zoom не выдаётся (401) — падает обратно на Jitsi, промис не отклоняется', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        text: () => Promise.resolve('unauthorized'),
      }),
    ) as any;
    const { service, prisma } = makeService(zoomConfig);
    const { url } = await service.createMeeting(TARGET);
    expect(url).toMatch(/meet\.jit\.si/);
    expect(prisma.clientMeeting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ zoomMeetingId: null }),
      }),
    );
  });

  it('сетевая ошибка при создании Zoom-встречи — падает на Jitsi, не бросает исключение наружу', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes('oauth/token')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'tok' }),
        }) as any;
      }
      throw new Error('network down');
    }) as any;
    const { service } = makeService(zoomConfig);
    await expect(service.createMeeting(TARGET)).resolves.toMatchObject({
      url: expect.stringMatching(/meet\.jit\.si/),
    });
  });

  it('апгрейд Jitsi→Zoom падает — существующая Jitsi-ссылка остаётся в силе, update не вызывается', async () => {
    const { service, prisma } = makeService(); // сначала Jitsi
    const { url: jitsiUrl } = await service.createMeeting(TARGET);

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve('zoom down'),
      }),
    ) as any;
    const config = {
      get: (key: string) => (zoomConfig as any)[key],
    } as unknown as ConfigService;
    const zoomService = new MeetingService(prisma, config);

    const result = await zoomService.createMeeting(TARGET);
    // старая ссылка не потеряна, и комната не сменилась
    expect(result).toEqual({ url: jitsiUrl, replaced: false });
    expect(prisma.clientMeeting.update).not.toHaveBeenCalled();
  });
});

// Аудит 2026-10 (утечка ссылки на встречу): комната Jitsi считалась из контакта
// (`schemehappens-<sha256(контакт)[0..12]>`), то есть знающий контакт клиента
// вычислял адрес его комнаты без запроса. Теперь имя случайное, а уже выданные
// комнаты по старой формуле заменяются при следующей брони.
describe('MeetingService.createMeeting — комната Jitsi не выводится из контакта', () => {
  const LEGACY = `https://meet.jit.si/schemehappens-${legacyClientKey('@maria').slice(0, 12)}`;

  it('новая комната не совпадает с формулой от контакта и различается у двух клиентов', async () => {
    const { service } = makeService();
    const { url: a } = await service.createMeeting(TARGET);
    const { url: b } = await service.createMeeting({
      ...TARGET,
      clientContact: '@other',
    });
    expect(a).toMatch(/^https:\/\/meet\.jit\.si\/schemehappens-[0-9a-f]{16}$/);
    expect(a).not.toBe(LEGACY);
    expect(isLegacyJitsiRoom(a)).toBe(false);
    expect(b).not.toBe(a);
  });

  it('комната по старой формуле при повторной брони заменяется случайной и записывается в ClientMeeting', async () => {
    const { service, prisma, store } = makeService();
    const key = clientKey('@maria');
    store.set(key, { clientKey: key, meetingUrl: LEGACY, zoomMeetingId: null });

    const { url, replaced } = await service.createMeeting(TARGET);

    expect(replaced).toBe(true); // владелец узнает о смене комнаты из DM
    expect(url).not.toBe(LEGACY);
    expect(url).toMatch(
      /^https:\/\/meet\.jit\.si\/schemehappens-[0-9a-f]{16}$/,
    );
    expect(prisma.clientMeeting.updateMany).toHaveBeenCalledWith({
      where: { clientKey: key, meetingUrl: LEGACY },
      data: { meetingUrl: expect.any(String) },
    });
    // read-after-write: следующая бронь получает уже новую комнату
    expect(decrypt(store.get(key).meetingUrl)).toBe(url);
    expect(await service.createMeeting(TARGET)).toEqual({
      url,
      replaced: false,
    });
  });

  it('не-legacy комната Jitsi и Zoom переиспользуются без записи в БД', async () => {
    const { service, prisma, store } = makeService();
    const key = clientKey('@maria');
    for (const kept of [
      'https://meet.jit.si/schemehappens-0123456789abcdef',
      'https://zoom.us/j/777?pwd=x',
    ]) {
      store.set(key, { clientKey: key, meetingUrl: kept, zoomMeetingId: null });
      expect(await service.createMeeting(TARGET)).toEqual({
        url: kept,
        replaced: false,
      });
    }
    expect(prisma.clientMeeting.update.mock.calls).toEqual([]);
    expect(prisma.clientMeeting.updateMany.mock.calls).toEqual([]);
  });

  it('гонка двух подтверждений: проигравший берёт комнату победителя, а не свою', async () => {
    const { service, prisma, store } = makeService();
    const key = clientKey('@maria');
    store.set(key, { clientKey: key, meetingUrl: LEGACY, zoomMeetingId: null });
    const WINNER = 'https://meet.jit.si/schemehappens-aaaaaaaaaaaaaaaa';
    // победитель записал свою комнату между нашим чтением и нашей записью
    prisma.clientMeeting.updateMany.mockImplementationOnce(() => {
      store.get(key).meetingUrl = WINNER;
      return Promise.resolve({ count: 0 });
    });

    // комната клиента всё равно сменилась — на комнату победителя
    expect(await service.createMeeting(TARGET)).toEqual({
      url: WINNER,
      replaced: true,
    });
    expect(store.get(key).meetingUrl).toBe(WINNER);
  });

  it('строку удалили между чтением и записью: бронь получает новую комнату, а не старую', async () => {
    const { service, prisma, store } = makeService();
    const key = clientKey('@maria');
    store.set(key, { clientKey: key, meetingUrl: LEGACY, zoomMeetingId: null });
    prisma.clientMeeting.updateMany.mockImplementationOnce(() => {
      store.delete(key);
      return Promise.resolve({ count: 0 });
    });
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const { url, replaced } = await service.createMeeting(TARGET);

    expect(url).toMatch(
      /^https:\/\/meet\.jit\.si\/schemehappens-[0-9a-f]{16}$/,
    );
    expect(url).not.toBe(LEGACY);
    expect(replaced).toBe(true);
    expect(warn.mock.calls[0][0]).toContain('vanished');
    warn.mockRestore();
  });

  // Ключ строки теперь HMAC (client-key.ts): старую комнату узнаём по форме
  // адреса, иначе после смены ключа вычисляемые комнаты не заменялись бы никогда.
  it('isLegacyJitsiRoom узнаёт старую формулу по форме адреса, не по ключу строки', () => {
    expect(isLegacyJitsiRoom(LEGACY)).toBe(true);
    expect(isLegacyJitsiRoom(`${LEGACY}0`)).toBe(false); // не префикс
    // случайная комната — 16 hex, не 12
    expect(
      isLegacyJitsiRoom('https://meet.jit.si/schemehappens-0123456789abcdef'),
    ).toBe(false);
    expect(
      isLegacyJitsiRoom('https://evil.example/schemehappens-0123456789ab'),
    ).toBe(false);
  });

  it('старая комната заменяется и у строки под новым ключом (после перевода ключей)', async () => {
    const { service, store } = makeService();
    const key = clientKey('@maria');
    expect(key).not.toBe(legacyClientKey('@maria'));
    store.set(key, { clientKey: key, meetingUrl: LEGACY, zoomMeetingId: null });
    const { url, replaced } = await service.createMeeting(TARGET);
    expect(replaced).toBe(true);
    expect(url).not.toBe(LEGACY);
    expect(decrypt(store.get(key).meetingUrl)).toBe(url);
  });
});
