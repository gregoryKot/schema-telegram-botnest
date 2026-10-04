// Волна 3 дошифровки (D-9, аудит 2026-10): AuthProvider.email/displayName,
// Booking.meetingUrl, ClientMeeting.meetingUrl. Крипто-модуль читает
// ENCRYPTION_KEY на загрузке, поэтому сервис и crypto подгружаются через
// resetModules+require ПОСЛЕ установки ключа (как в волне 2) — иначе encrypt()
// был бы identity и тест ничего не проверял.
import type { Logger as LoggerType } from '@nestjs/common';
import type { EncryptionWave3Service } from './encryption-wave3.service';

type Row = Record<string, unknown> & { id?: number };
type Ctor = new (prisma: unknown) => EncryptionWave3Service;

let ServiceCtor: Ctor;
let decryptFn: (v: string | null | undefined) => string | null;
let encryptFn: (v: string | null | undefined) => string | null;
let LoggerCtor: typeof LoggerType;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ServiceCtor = (
    require('./encryption-wave3.service') as {
      EncryptionWave3Service: Ctor;
    }
  ).EncryptionWave3Service;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const c = require('../utils/crypto') as typeof import('../utils/crypto');
  decryptFn = c.decrypt;
  encryptFn = c.encrypt;
  // Logger из того же реестра модулей, что и сервис (иначе spyOn мимо).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  LoggerCtor = (require('@nestjs/common') as typeof import('@nestjs/common'))
    .Logger;
});

afterEach(() => jest.restoreAllMocks());

// Таблица с курсором по id и условным updateMany — как делает сервис.
function table(rows: Row[], key = 'id', updated = 1) {
  return {
    rows,
    findMany: jest.fn(
      (args: { where?: { id?: { gt: number } }; take?: number }) => {
        const after = args.where?.id?.gt ?? -1;
        const page = rows.filter(
          (r) => key !== 'id' || (r.id as number) > after,
        );
        return Promise.resolve(args.take ? page.slice(0, args.take) : page);
      },
    ),
    updateMany: jest.fn((args: { where: Row; data: Row }) => {
      const row = rows.find((r) => r[key] === args.where[key]);
      if (updated > 0 && row) Object.assign(row, args.data);
      return Promise.resolve({ count: updated });
    }),
  };
}

function makeDb(
  seed: {
    authProvider?: Row[];
    booking?: Row[];
    clientMeeting?: Row[];
  } = {},
  opts: { flag?: boolean; updated?: number } = {},
) {
  return {
    authProvider: table(seed.authProvider ?? [], 'id', opts.updated),
    booking: table(seed.booking ?? [], 'id', opts.updated),
    clientMeeting: table(seed.clientMeeting ?? [], 'clientKey', opts.updated),
    bookingSetting: {
      findUnique: jest.fn(() =>
        Promise.resolve(opts.flag ? ({ key: 'x' } as Row) : null),
      ),
      upsert: jest.fn((args: Row) => Promise.resolve(args)),
    },
  };
}

const svc = (db: ReturnType<typeof makeDb>) => new ServiceCtor(db);
const ZOOM = 'https://us02web.zoom.us/j/123456789?pwd=SECRETPWD';

describe('EncryptionWave3Service — дошифровка plaintext (D-9)', () => {
  it('открытые email/имя/ссылки шифруются (round-trip), условный update, флаг ставится', async () => {
    const db = makeDb({
      authProvider: [
        { id: 1, email: 'a@example.com', displayName: 'Аня Иванова' },
        { id: 2, email: null, displayName: 'Только имя' },
      ],
      booking: [{ id: 10, meetingUrl: ZOOM }],
      clientMeeting: [{ clientKey: 'k1', meetingUrl: ZOOM }],
    });

    const total = await svc(db).run();

    expect(total).toBe(4);
    const [a1, a2] = db.authProvider.rows;
    expect(a1.email).not.toBe('a@example.com');
    expect(decryptFn(a1.email as string)).toBe('a@example.com');
    expect(decryptFn(a1.displayName as string)).toBe('Аня Иванова');
    expect(a2.email).toBeNull();
    expect(decryptFn(a2.displayName as string)).toBe('Только имя');
    expect(db.booking.rows[0].meetingUrl).not.toContain('pwd=');
    expect(decryptFn(db.booking.rows[0].meetingUrl as string)).toBe(ZOOM);
    expect(decryptFn(db.clientMeeting.rows[0].meetingUrl as string)).toBe(ZOOM);
    // Условный update: в where — прочитанное значение, а не только id.
    expect(db.booking.updateMany.mock.calls[0][0].where).toEqual({
      id: 10,
      meetingUrl: ZOOM,
    });
    expect(db.bookingSetting.upsert).toHaveBeenCalledTimes(1);
  });

  it('идемпотентна: уже шифрованное, пустое и null не трогаются', async () => {
    const enc = encryptFn('a@example.com')!;
    const db = makeDb({
      authProvider: [{ id: 1, email: enc, displayName: null }],
      booking: [{ id: 10, meetingUrl: encryptFn(ZOOM) }],
      clientMeeting: [{ clientKey: 'k1', meetingUrl: encryptFn(ZOOM) }],
    });
    expect(await svc(db).run()).toBe(0);
    expect(db.authProvider.updateMany).not.toHaveBeenCalled();
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.clientMeeting.updateMany).not.toHaveBeenCalled();
    expect(db.authProvider.rows[0].email).toBe(enc);
  });

  // Ключ, которым шифровали, могли убрать из конфигурации: строка не
  // расшифровывается, но и открытым текстом не является. Повторное шифрование
  // сделало бы оригинал нечитаемым навсегда.
  it('строку, похожую на шифротекст неизвестного ключа, не шифрует повторно', async () => {
    const foreign = Buffer.alloc(48, 7).toString('base64');
    const db = makeDb({ booking: [{ id: 1, meetingUrl: foreign }] });
    expect(await svc(db).run()).toBe(0);
    expect(db.booking.rows[0].meetingUrl).toBe(foreign);
  });

  it('второй запуск ничего не делает: флаг уже стоит', async () => {
    const db = makeDb(
      { booking: [{ id: 1, meetingUrl: ZOOM }] },
      { flag: true },
    );
    expect(await svc(db).run()).toBe(0);
    expect(db.booking.findMany).not.toHaveBeenCalled();
  });

  it('без ENCRYPTION_KEY ничего не трогает (dev/CI)', async () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      const db = makeDb({ booking: [{ id: 1, meetingUrl: ZOOM }] });
      expect(await svc(db).run()).toBe(0);
      expect(db.bookingSetting.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env.ENCRYPTION_KEY = saved;
    }
  });

  it('идёт пачками по курсору id: 1200 строк AuthProvider обработаны все', async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => ({
      id: i + 1,
      email: `user${i}@example.com`,
      displayName: null,
    }));
    const db = makeDb({ authProvider: rows });
    expect(await svc(db).run()).toBe(1200);
    expect(db.authProvider.findMany.mock.calls.length).toBeGreaterThanOrEqual(
      3,
    );
    expect(decryptFn(rows[1199].email as string)).toBe('user1199@example.com');
  });

  it('строка изменилась между чтением и записью → не затираем, флаг не ставим', async () => {
    const db = makeDb(
      { booking: [{ id: 1, meetingUrl: ZOOM }] },
      { updated: 0 },
    );
    const warn = jest
      .spyOn(LoggerCtor.prototype, 'warn')
      .mockImplementation(() => undefined);
    expect(await svc(db).run()).toBe(0);
    expect(db.bookingSetting.upsert).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('retry'));
  });

  it('ошибка БД на старте логируется и не роняет приложение, флаг не ставится', async () => {
    const db = makeDb();
    db.authProvider.findMany.mockRejectedValue(new Error('db down'));
    const err = jest
      .spyOn(LoggerCtor.prototype, 'error')
      .mockImplementation(() => undefined);
    await expect(svc(db).onApplicationBootstrap()).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledWith(expect.stringContaining('db down'));
    expect(db.bookingSetting.upsert).not.toHaveBeenCalled();
  });
});
