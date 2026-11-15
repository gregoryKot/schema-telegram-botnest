// Шов команды с базой: кто держит комнату Zoom вне чистки (roomRefs и
// zoomRoomIds в foreign-scrub.command.ts). Поддельная Prisma исполняет where,
// ссылки броней — шифротекст, как в базе: ошибка в выборке удалила бы комнату
// живой брони, а удаление в Zoom не откатить. Ключи — при загрузке (loadWithKeys).
import type { ConfigService } from '@nestjs/config';
import { loadWithKeys } from '../test-support/load-with-keys';
import { CalDavService } from './caldav.service';
import { MeetingService } from './meeting.service';

type Command = typeof import('./foreign-scrub.command');
type Crypto = typeof import('../utils/crypto');
/* eslint-disable @typescript-eslint/no-require-imports */
const { command, crypto } = loadWithKeys({ key: 'ef'.repeat(32) }, () => ({
  command: require('./foreign-scrub.command') as Command,
  crypto: require('../utils/crypto') as Crypto,
}));
/* eslint-enable @typescript-eslint/no-require-imports */
afterAll(() => {
  delete process.env.ENCRYPTION_KEY;
  delete process.env.ENCRYPTION_KEY_OLD;
});

const HELD = '81000000021'; // ссылка живой брони
const STALE = '81000000022'; // ссылка только у обезличенной брони
const ROW = '81000000023'; // строка ClientMeeting
const link = (id: string) =>
  crypto.encrypt(`https://us02web.zoom.us/j/${id}?pwd=room`);

type Row = Record<string, unknown>;
const NOT_NULL = JSON.stringify({ not: null });
/** findMany с where: null — IS NULL, { not: null } — IS NOT NULL, иное — сбой теста. */
function table(rows: Row[]) {
  const match = (r: Row, where: Row) =>
    Object.entries(where).every(([k, v]) => {
      if (v === null) return r[k] === null;
      if (JSON.stringify(v) === NOT_NULL) return r[k] !== null;
      throw new Error(`поддельная Prisma не знает условия ${k}`);
    });
  return {
    findMany: jest.fn(({ where }: { where: Row }) =>
      Promise.resolve(rows.filter((r) => match(r, where))),
    ),
  };
}

const prisma = {
  booking: table([
    { anonymizedAt: null, meetingUrl: link(HELD) },
    // Обезличивание оставляет ссылку (booking-retention.service.ts).
    { anonymizedAt: new Date('2025-01-10T00:00:00Z'), meetingUrl: link(STALE) },
    { anonymizedAt: null, meetingUrl: null },
  ]),
  clientMeeting: table([{ zoomMeetingId: ROW }, { zoomMeetingId: null }]),
};

// iCloud не настроен: в базу ходит только сверка комнат.
const ENV: Record<string, string> = {
  ZOOM_ACCOUNT_ID: 'acc',
  ZOOM_CLIENT_ID: 'cid',
  ZOOM_CLIENT_SECRET: 'sec',
};
const config = { get: (k: string) => ENV[k] } as unknown as ConfigService;

// Все три — комнаты бота (type 3); у HELD прежняя тема с именем.
const ROOMS = new Map([
  [HELD, 'Сессии — Имя Клиента'],
  [STALE, 'Сессия'],
  [ROW, 'Сессия'],
]);
let writes: string[];
function zoom(url: string, init: RequestInit = {}) {
  const method = init.method ?? 'GET';
  if (method !== 'GET' && !url.includes('/oauth/'))
    writes.push(`${method} ${url}`);
  const meetings = [...ROOMS].map(([id, topic]) => ({
    id: Number(id),
    topic,
    type: 3,
  }));
  const id = /\/meetings\/(\d+)/.exec(url)?.[1] ?? '';
  const json = url.includes('/oauth/')
    ? { access_token: 't' }
    : url.includes('/users/me/')
      ? { next_page_token: '', meetings }
      : { topic: ROOMS.get(id) };
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(json),
  });
}

const originalFetch = global.fetch;
beforeEach(() => {
  writes = [];
  global.fetch = jest.fn(zoom);
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe('ForeignScrubCommand: кто держит комнату Zoom', () => {
  it('живая бронь с шифрованной ссылкой держит комнату, обезличенная — нет, строка ClientMeeting — не сирота', async () => {
    const cmd = new command.ForeignScrubCommand(
      null,
      prisma as never,
      new CalDavService(config),
      new MeetingService(prisma as never, config),
    );
    cmd.pauseMs = 0;
    await cmd.report(true, new Date('2026-11-15T10:00:00Z'));

    expect(writes).toEqual([
      `PATCH https://api.zoom.us/v2/meetings/${HELD}`,
      `DELETE https://api.zoom.us/v2/meetings/${STALE}?schedule_for_reminder=false`,
    ]);
  });
});
