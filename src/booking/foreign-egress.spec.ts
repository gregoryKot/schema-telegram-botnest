// 152-ФЗ, ч. 5 ст. 18 (запрос Роскомнадзора №08-1063539 от 11.11.2026):
// iCloud (CalDAV) и Zoom — зарубежные базы, данные клиента туда не уходят.
// Тест идёт через шов: настоящие runConfirmEffects + CalDavService +
// MeetingService, подменён только fetch. Бронь несёт узнаваемые значения, и ни
// одно из них не должно встретиться в исходящих запросах ЦЕЛИКОМ — адрес,
// заголовки, тело (после раскладки переноса строк RFC 5545).
import { ConfigService } from '@nestjs/config';
import { BookingStatus, SessionType } from '@prisma/client';
import { runConfirmEffects } from './booking-confirm-run';
import { CalDavService } from './caldav.service';
import { MeetingService, ZOOM_TOPIC } from './meeting.service';
import { buildOwnerVcalendar, ownerEventFor } from './caldav-owner-event';
import type { PlainBooking } from './booking-notify.service';

const SECRETS = {
  name: 'Евлампия Узнаваемая-Фамилия',
  contact: '+79991234567',
  nick: '@evlampia_marker',
  email: 'evlampia.marker@example.ru',
  message: 'Текст обращения-маркер: тревога, бессонница; подробности, детали',
  source: 'landing-marker-utm',
  token: 'cancel-token-marker',
};
const ZOOM_URL = 'https://zoom.us/j/987654321?pwd=room-marker';
const USER_ID = 7700123;

function booking(over: Partial<PlainBooking> = {}): PlainBooking {
  return {
    id: 42,
    userId: USER_ID,
    startsAt: new Date('2026-12-01T17:00:00Z'),
    durationMin: 50,
    type: SessionType.SESSION_50,
    clientName: SECRETS.name,
    clientContact: SECRETS.contact,
    clientEmail: SECRETS.email,
    clientNick: SECRETS.nick,
    clientChannel: 'phone',
    message: SECRETS.message,
    meetingUrl: null,
    cancelToken: SECRETS.token,
    source: SECRETS.source,
    clientTimeZone: 'Asia/Vladivostok',
    ...over,
  } as PlainBooking;
}

interface Sent {
  url: string;
  method: string;
  text: string; // адрес + заголовки + тело одной строкой
  body: string;
}

function captureFetch(): Sent[] {
  const sent: Sent[] = [];
  global.fetch = jest.fn((url: string, init: RequestInit = {}) => {
    const body = typeof init.body === 'string' ? init.body : '';
    // RFC 5545 §3.1: длинная строка сложена через CRLF + пробел — раскладываем,
    // иначе имя, разрезанное переносом, проскочило бы мимо проверки.
    const unfolded = body.replace(/\r\n /g, '');
    sent.push({
      url,
      method: init.method ?? 'GET',
      text: [url, JSON.stringify(init.headers ?? {}), body, unfolded].join(
        '\n',
      ),
      body: unfolded,
    });
    if (url.includes('oauth/token'))
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ access_token: 'tok' }),
      });
    if (url.includes('zoom.us'))
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ join_url: ZOOM_URL, id: 987654321 }),
      });
    return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
  });
  return sent;
}

function makeDeps() {
  const env: Record<string, string> = {
    APPLE_ID: 'owner@icloud.com',
    APPLE_APP_PASSWORD: 'pw',
    APPLE_CALDAV_URL: 'https://p1-caldav.icloud.com/1/calendars/work/',
    ZOOM_ACCOUNT_ID: 'acc',
    ZOOM_CLIENT_ID: 'cid',
    ZOOM_CLIENT_SECRET: 'sec',
  };
  const config = { get: (k: string) => env[k] } as unknown as ConfigService;
  const prisma = {
    booking: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest
        .fn()
        .mockResolvedValue({ status: BookingStatus.CONFIRMED }),
    },
    clientMeeting: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const notifyAdminBoth = jest.fn().mockResolvedValue(undefined);
  return {
    deps: {
      prisma: prisma as never,
      meeting: new MeetingService(prisma as never, config),
      calDav: new CalDavService(config),
      notifyAdminBoth,
    },
    notifyAdminBoth,
  };
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

/** Узнаваемые значения и их куски: целиком, по словам, без «+» и «@». */
function markers(): string[] {
  return [
    ...Object.values(SECRETS),
    'Евлампия',
    'Узнаваемая',
    '9991234567',
    'evlampia',
    'обращения-маркер',
    'бессонница',
    'room-marker',
    'Vladivostok',
    String(USER_ID),
  ];
}

describe('данные клиента не уходят в iCloud и Zoom', () => {
  it('подтверждение брони: ни в одном исходящем запросе нет имени, контакта, текста обращения', async () => {
    const sent = captureFetch();
    const { deps } = makeDeps();
    await runConfirmEffects(deps, booking());

    const put = sent.find((r) => r.method === 'PUT');
    const zoom = sent.find((r) => r.url.includes('/v2/users/me/meetings'));
    expect(put).toBeDefined(); // контроль: запросы действительно ушли
    expect(zoom).toBeDefined();
    for (const req of sent)
      for (const marker of markers()) expect(req.text).not.toContain(marker);
  });

  it('в iCloud уходит только время, тип записи и номер брони', async () => {
    const sent = captureFetch();
    const { deps } = makeDeps();
    await runConfirmEffects(deps, booking());

    const put = sent.find((r) => r.method === 'PUT')!;
    expect(put.url).toBe(
      'https://p1-caldav.icloud.com/1/calendars/work/booking-42@schemehappens.ru.ics',
    );
    const lines = put.body
      .split('\r\n')
      .filter((l) => l && !l.startsWith('DTSTAMP:'));
    expect(lines).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//schemehappens//booking//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Запись на сессии',
      'BEGIN:VEVENT',
      'UID:booking-42@schemehappens.ru',
      'DTSTART:20261201T170000Z',
      'DTEND:20261201T175000Z',
      'SUMMARY:Сессия (50 мин)',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
  });

  it('знакомство называется по типу записи, без имени', () => {
    const ev = ownerEventFor(booking({ type: SessionType.INTRO_15 }));
    expect(ev).toEqual({
      uid: 'booking-42@schemehappens.ru',
      startsAt: new Date('2026-12-01T17:00:00Z'),
      durationMin: 15, // знакомство короче слота: session-event.ts
      summary: 'Знакомство (15 мин)',
    });
  });

  it('лишние поля, приехавшие мимо типа, в тело PUT не попадают', () => {
    const leaky = {
      ...ownerEventFor(booking()),
      description: SECRETS.message,
      location: ZOOM_URL,
      organizerEmail: SECRETS.email,
      url: `https://schemehappens.ru/booking/manage?token=${SECRETS.token}`,
    };
    const body = buildOwnerVcalendar(leaky).replace(/\r\n /g, '');
    expect(body).not.toMatch(/DESCRIPTION|LOCATION|ORGANIZER|ATTENDEE|URL/);
    for (const marker of markers()) expect(body).not.toContain(marker);
  });

  it('в Zoom уходит только обезличенное название и настройки комнаты', async () => {
    const sent = captureFetch();
    const { deps } = makeDeps();
    await runConfirmEffects(deps, booking());

    const zoom = sent.find((r) => r.url.includes('/v2/users/me/meetings'))!;
    expect(JSON.parse(zoom.body)).toEqual({
      topic: 'Сессия',
      type: 3,
      timezone: 'Europe/Moscow',
      settings: { join_before_host: true, waiting_room: true },
    });
    expect(ZOOM_TOPIC).toBe('Сессия');
  });

  it('владелец по-прежнему видит, кто придёт: письмо несёт имя, контакт, текст и ссылку; Telegram — только ссылку', async () => {
    captureFetch();
    const { deps, notifyAdminBoth } = makeDeps();
    await runConfirmEffects(deps, booking());

    const [card] = notifyAdminBoth.mock.calls[0] as [
      { telegram: string; email: string },
      string,
    ];
    expect(card.email).toContain(SECRETS.name);
    expect(card.email).toContain(SECRETS.contact);
    expect(card.email).toContain('Текст обращения-маркер');
    expect(card.email).toContain(ZOOM_URL);
    expect(card.telegram).toContain(ZOOM_URL);
    for (const v of [SECRETS.name, SECRETS.contact, SECRETS.message]) {
      expect(card.telegram).not.toContain(v);
    }
  });
});
