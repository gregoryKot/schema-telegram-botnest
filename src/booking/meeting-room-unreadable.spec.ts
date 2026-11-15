// Повторная бронь, когда комната клиента зашифрована ключом, которого нет в
// env: decrypt() отдал бы сам шифротекст, и он ушёл бы клиенту в бронь.
// Ключи читаются при загрузке модулей — грузим под ключом (loadWithKeys).
import type { ConfigService } from '@nestjs/config';
import { loadWithKeys } from '../test-support/load-with-keys';
import type { MeetingTarget } from './meeting.service';

type Svc = typeof import('./meeting.service');
type Jitsi = typeof import('./meeting-jitsi');
type Keys = typeof import('./client-key');
type Crypto = typeof import('../utils/crypto');
type Nest = typeof import('@nestjs/common');

const KEY = 'ab'.repeat(32);
const foreign = loadWithKeys(
  { key: 'cd'.repeat(32) },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('../utils/crypto') as Crypto,
);
const app = loadWithKeys({ key: KEY }, () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  svc: require('./meeting.service') as Svc,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  jitsi: require('./meeting-jitsi') as Jitsi,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  keys: require('./client-key') as Keys,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  crypto: require('../utils/crypto') as Crypto,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nest: require('@nestjs/common') as Nest,
}));
afterAll(() => delete process.env.ENCRYPTION_KEY);

const NEW_ROOM = /^https:\/\/meet\.jit\.si\/schemehappens-[0-9a-f]{16}$/;
const TARGET = {
  id: 1,
  startsAt: new Date('2026-07-13T17:00:00Z'),
  durationMin: 50,
  type: 'INDIVIDUAL',
  clientName: 'Мария',
  clientContact: '@maria',
} as MeetingTarget;

interface Row {
  clientKey: string;
  meetingUrl: string;
  zoomMeetingId: string | null;
}
type Where<T> = { where: T };

function setup(meetingUrl: string) {
  const key = app.keys.clientKey('@maria');
  const store = new Map<string, Row>([
    [key, { clientKey: key, meetingUrl, zoomMeetingId: null }],
  ]);
  const prisma = {
    clientMeeting: {
      findMany: jest.fn(({ where }: Where<{ clientKey: { in: string[] } }>) =>
        Promise.resolve(where.clientKey.in.flatMap((k) => store.get(k) ?? [])),
      ),
      findUnique: jest.fn(({ where }: Where<{ clientKey: string }>) =>
        Promise.resolve(store.get(where.clientKey) ?? null),
      ),
      update: jest.fn(),
      // условная запись, как в Postgres: строка ушла из-под where — count 0
      updateMany: jest.fn(
        ({ where, data }: Where<Row> & { data: Partial<Row> }) => {
          const row = store.get(where.clientKey);
          if (!row || row.meetingUrl !== where.meetingUrl)
            return Promise.resolve({ count: 0 });
          Object.assign(row, data);
          return Promise.resolve({ count: 1 });
        },
      ),
    },
  };
  const config = { get: () => undefined } as unknown as ConfigService;
  const service = new app.svc.MeetingService(prisma as never, config);
  jest
    .spyOn(app.nest.Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  return { service, prisma, store, key };
}

afterEach(() => jest.restoreAllMocks());

describe('Повторная бронь: нечитаемая комната клиента', () => {
  it('строка под чужим ключом → новая комната, запись по прежнему шифротексту', async () => {
    const lost = foreign.encrypt('https://zoom.us/j/1?pwd=x') as string;
    const { service, prisma, store, key } = setup(lost);

    const { url, replaced } = await service.createMeeting(TARGET);

    expect(url).toMatch(NEW_ROOM);
    expect(replaced).toBe(true); // владелец узнает о смене комнаты из DM
    expect(prisma.clientMeeting.updateMany).toHaveBeenCalledWith({
      where: { clientKey: key, meetingUrl: lost },
      data: { meetingUrl: expect.any(String) },
    });
    // сохранил → нашёл: следующая бронь переиспользует новую комнату
    expect(app.crypto.decrypt(store.get(key)!.meetingUrl)).toBe(url);
    expect(await service.createMeeting(TARGET)).toEqual({
      url,
      replaced: false,
    });
  });

  it('гонка двух броней: проигравший берёт комнату победителя', async () => {
    const lost = foreign.encrypt('https://zoom.us/j/1') as string;
    const { service, prisma, store, key } = setup(lost);
    const WINNER = 'https://meet.jit.si/schemehappens-aaaaaaaaaaaaaaaa';
    prisma.clientMeeting.updateMany.mockImplementationOnce(() => {
      store.get(key)!.meetingUrl = app.crypto.encrypt(WINNER)!;
      return Promise.resolve({ count: 0 });
    });

    expect(await service.createMeeting(TARGET)).toEqual({
      url: WINNER,
      replaced: true,
    });
  });

  it('победитель гонки тоже нечитаем — бронь отдаёт свою свежую ссылку', async () => {
    const lost = foreign.encrypt('https://zoom.us/j/1') as string;
    const { service, prisma, store, key } = setup(lost);
    const alsoLost = foreign.encrypt('https://zoom.us/j/2') as string;
    prisma.clientMeeting.updateMany.mockImplementationOnce(() => {
      store.get(key)!.meetingUrl = alsoLost;
      return Promise.resolve({ count: 0 });
    });

    const { url, replaced } = await service.createMeeting(TARGET);
    expect(url).toMatch(NEW_ROOM);
    expect(replaced).toBe(true);
  });

  it('читаемая комната переиспользуется без записи', async () => {
    const room = 'https://meet.jit.si/schemehappens-0123456789abcdef';
    const { service, prisma } = setup(app.crypto.encrypt(room)!);

    expect(await service.createMeeting(TARGET)).toEqual({
      url: room,
      replaced: false,
    });
    expect(prisma.clientMeeting.updateMany).not.toHaveBeenCalled();
  });
});

describe('readRoomUrl', () => {
  it('открытая https-ссылка читается как есть, чужой шифр и мусор — null', () => {
    const { readRoomUrl } = app.jitsi;
    const plain = 'https://zoom.us/j/777?pwd=x';
    expect(readRoomUrl(plain)).toBe(plain);
    expect(readRoomUrl(foreign.encrypt('https://zoom.us/j/1')!)).toBeNull();
    expect(readRoomUrl('k1:abc')).toBeNull();
  });
});
