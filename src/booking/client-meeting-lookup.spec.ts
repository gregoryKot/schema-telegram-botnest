// Поиск комнаты клиента по HMAC-ключам (аудит 2026-10). Окно ротации
// ENCRYPTION_KEY: строка, записанная под старым ключом, находится и переезжает
// на текущий ключ — условно, чтобы два подтверждения не разошлись по двум
// строкам. Ключи читаются при загрузке модулей — грузим под парой ключей.
import { loadWithKeys } from '../test-support/load-with-keys';

type Lookup = typeof import('./client-meeting-lookup');
type Keys = typeof import('./client-key');
const KEY = 'ab'.repeat(32);
const OLD = 'cd'.repeat(32);
const CONTACT = 'Ivan-Petrov@X.ru';
const URL = 'enc(https://zoom.example/j/1)';

const rotated = loadWithKeys({ key: KEY, old: OLD }, () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  lookup: require('./client-meeting-lookup') as Lookup,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  keys: require('./client-key') as Keys,
}));
const oldKey = loadWithKeys(
  { key: OLD },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('./client-key') as Keys,
).clientKey(CONTACT);
const newKey = rotated.keys.clientKey(CONTACT);

afterAll(() => {
  delete process.env.ENCRYPTION_KEY;
  delete process.env.ENCRYPTION_KEY_OLD;
});

type Row = { clientKey: string; meetingUrl: string };
function fakePrisma(rows: Row[]) {
  const byKey = (k: string) => rows.find((r) => r.clientKey === k) ?? null;
  return {
    rows,
    clientMeeting: {
      count: jest.fn(({ where }: any) =>
        Promise.resolve(
          rows.filter((r) => where.clientKey.in.includes(r.clientKey)).length,
        ),
      ),
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(
          rows.filter((r) => where.clientKey.in.includes(r.clientKey)),
        ),
      ),
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(byKey(where.clientKey)),
      ),
      updateMany: jest.fn(({ where, data }: any) => {
        const row = byKey(where.clientKey);
        if (!row || row.meetingUrl !== where.meetingUrl)
          return Promise.resolve({ count: 0 });
        if (byKey(data.clientKey))
          return Promise.reject(
            Object.assign(new Error('dup'), { code: 'P2002' }),
          );
        row.clientKey = data.clientKey;
        return Promise.resolve({ count: 1 });
      }),
    },
  };
}

describe('findClientMeeting — окно ротации ENCRYPTION_KEY', () => {
  it('строка под ключом OLD находится и переезжает на текущий ключ', async () => {
    const prisma = fakePrisma([{ clientKey: oldKey, meetingUrl: URL }]);
    const found = await rotated.lookup.findClientMeeting(
      prisma as any,
      CONTACT,
    );
    expect(found).toEqual({ clientKey: newKey, meetingUrl: URL });
    expect(prisma.rows).toEqual([{ clientKey: newKey, meetingUrl: URL }]);
    expect(await rotated.lookup.hasClientMeeting(prisma as any, CONTACT)).toBe(
      true,
    );
  });

  it('строка под текущим ключом берётся как есть, без записи', async () => {
    const prisma = fakePrisma([{ clientKey: newKey, meetingUrl: URL }]);
    const found = await rotated.lookup.findClientMeeting(
      prisma as any,
      CONTACT,
    );
    expect(found?.clientKey).toBe(newKey);
    expect(prisma.clientMeeting.updateMany.mock.calls).toEqual([]);
  });

  it('гонка: строку перенёс сосед (count 0) — берётся его строка', async () => {
    const prisma = fakePrisma([{ clientKey: oldKey, meetingUrl: URL }]);
    prisma.clientMeeting.updateMany.mockImplementationOnce(() => {
      prisma.rows[0].clientKey = newKey;
      return Promise.resolve({ count: 0 });
    });
    const found = await rotated.lookup.findClientMeeting(
      prisma as any,
      CONTACT,
    );
    expect(found).toEqual({ clientKey: newKey, meetingUrl: URL });
  });

  it('гонка: под текущим ключом строку уже записали (P2002) — берётся она', async () => {
    const OTHER = 'enc(https://zoom.example/j/2)';
    const prisma = fakePrisma([{ clientKey: oldKey, meetingUrl: URL }]);
    prisma.clientMeeting.findMany.mockImplementationOnce(() => {
      const snapshot = [...prisma.rows];
      prisma.rows.push({ clientKey: newKey, meetingUrl: OTHER });
      return Promise.resolve(snapshot);
    });
    const found = await rotated.lookup.findClientMeeting(
      prisma as any,
      CONTACT,
    );
    expect(found).toEqual({ clientKey: newKey, meetingUrl: OTHER });
  });

  it('другой ящик, совпадавший по старой формуле, строку не находит', async () => {
    const prisma = fakePrisma([{ clientKey: newKey, meetingUrl: URL }]);
    expect(
      await rotated.lookup.findClientMeeting(prisma as any, 'ivanpetrov@x.ru'),
    ).toBeNull();
    expect(
      await rotated.lookup.hasClientMeeting(prisma as any, 'ivanpetrov@x.ru'),
    ).toBe(false);
  });

  it('чужая ошибка записи не глотается', async () => {
    const prisma = fakePrisma([{ clientKey: oldKey, meetingUrl: URL }]);
    prisma.clientMeeting.updateMany.mockImplementationOnce(() =>
      Promise.reject(new Error('db down')),
    );
    await expect(
      rotated.lookup.findClientMeeting(prisma as any, CONTACT),
    ).rejects.toThrow('db down');
  });
});
