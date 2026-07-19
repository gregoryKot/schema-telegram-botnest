// MeetingService раздаёт персональную ссылку на созвон. Деньги тут не
// напрямую, но провал внешнего вызова (Zoom OAuth/API) НЕ должен ронять
// createMeeting и терять бронь — при сбое обязан быть Jitsi-фолбэк. Это и
// есть ключевой инвариант, который проверяем ниже.
import { ConfigService } from '@nestjs/config';
import { MeetingService, MeetingTarget } from './meeting.service';

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
      create: jest.fn(({ data }: any) => {
        store.set(data.clientKey, { ...data });
        return Promise.resolve({ ...data });
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = store.get(where.clientKey);
        Object.assign(row, data);
        return Promise.resolve(row);
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
    const url = await service.createMeeting(TARGET);
    expect(url).toBe('https://meet.example.com/room');
    expect(prisma.clientMeeting.findUnique).not.toHaveBeenCalled();
  });
});

describe('MeetingService.createMeeting — без Zoom (dev), Jitsi по умолчанию', () => {
  it('новый клиент — создаётся детерминированная Jitsi-комната, запись в БД', async () => {
    const { service, prisma } = makeService();
    const url = await service.createMeeting(TARGET);
    expect(url).toMatch(/^https:\/\/meet\.jit\.si\/schemehappens-/);
    expect(prisma.clientMeeting.create).toHaveBeenCalledTimes(1);
  });

  it('нормализация контакта: "@Maria", " maria ", "+7 999" дают ОДИН и тот же clientKey (SHA-256)', async () => {
    const { service, prisma } = makeService();
    const url1 = await service.createMeeting({
      ...TARGET,
      clientContact: '@Maria',
    });
    const url2 = await service.createMeeting({
      ...TARGET,
      clientContact: ' maria ',
    });
    expect(url2).toBe(url1); // тот же ключ → та же существующая запись
    expect(prisma.clientMeeting.create).toHaveBeenCalledTimes(1); // второй раз не создавали
  });

  it('возвращающийся клиент получает ту же ссылку повторно, create не вызывается снова', async () => {
    const { service, prisma } = makeService();
    const first = await service.createMeeting(TARGET);
    prisma.clientMeeting.create.mockClear();
    const second = await service.createMeeting(TARGET);
    expect(second).toBe(first);
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
    const url = await service.createMeeting(TARGET);
    expect(url).toBe('https://zoom.us/j/123');
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
    const jitsiUrl = await service.createMeeting(TARGET);
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

    const upgraded = await zoomService.createMeeting(TARGET);
    expect(upgraded).toBe('https://zoom.us/j/123');
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
    const url = await service.createMeeting(TARGET);
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
    await expect(service.createMeeting(TARGET)).resolves.toMatch(
      /meet\.jit\.si/,
    );
  });

  it('апгрейд Jitsi→Zoom падает — существующая Jitsi-ссылка остаётся в силе, update не вызывается', async () => {
    const { service, prisma } = makeService(); // сначала Jitsi
    const jitsiUrl = await service.createMeeting(TARGET);

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
    expect(result).toBe(jitsiUrl); // старая ссылка не потеряна
    expect(prisma.clientMeeting.update).not.toHaveBeenCalled();
  });
});
