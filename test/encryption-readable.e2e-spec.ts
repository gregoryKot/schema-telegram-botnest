// Провал расшифровки на РЕАЛЬНОМ Postgres (правило №18; аудит 2026-10, D-8).
// Ветка `typeof v === 'string'` в decryptRecord держится на том, что Prisma 7 с
// driver-adapter отдаёт Json-колонку со строкой шифротекста как JS-строку; мок
// Prisma этого не проверяет. Сценарий: данные записаны ключом A, процесс живёт
// под ключом B (опечатка/недокатившаяся ротация) →
//  - Json-колонка User.mySchemaIds читается как `[]` с маркером, а не как
//    base64-строка в роли списка;
//  - текстовая Note.text остаётся сырым значением (fail-open), но в маркере;
//  - проба encryptionReadable на тех же строках красная и называет обе колонки,
//    под правильными ключами — зелёная;
//  - та же проба по всему TARGETS читает каждую таблицу без ошибки драйвера.
// Гоняется в CI-джобе `migrations`.
import { PrismaService } from '../src/prisma/prisma.service';
import { loadWithKeys } from '../src/test-support/load-with-keys';

type CryptoModule = typeof import('../src/utils/crypto');
type ProbeModule =
  typeof import('../src/infra/self-check/probe-encryption-readable');

const KEY_A = 'aa'.repeat(32);
const KEY_B = 'bb'.repeat(32);
// Ключ остальных e2e-спеков джобы (test/setup-e2e.ts).
const KEY_E2E = '0'.repeat(64);
const USER = 910000000101n;

const cryptoUnder = (key: string, old?: string): CryptoModule =>
  loadWithKeys(
    { key, old },
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    () => require('../src/utils/crypto') as CryptoModule,
  );
const probeUnder = (key: string, old?: string): ProbeModule =>
  loadWithKeys(
    { key, old },
    () =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../src/infra/self-check/probe-encryption-readable') as ProbeModule,
  );

describe('нечитаемые данные на реальном Postgres', () => {
  let prisma: PrismaService;
  const TEXT = 'секретная заметка про схему';

  /** Только наши строки: чужие недочищенные записи других спеков не мешают. */
  const scoped = () =>
    new Proxy(prisma, {
      get(target, name: string) {
        const d = (target as unknown as Record<string, unknown>)[name] as {
          findMany(a: Record<string, unknown>): Promise<unknown>;
          updateMany: unknown;
        };
        if (name !== 'user' && name !== 'note') return d;
        const where = name === 'user' ? { id: USER } : { userId: USER };
        return {
          findMany: (a: Record<string, unknown>) => d.findMany({ ...a, where }),
          updateMany: d.updateMany,
        };
      },
    });

  const targets = [
    { name: 'note', fields: ['text'] },
    { name: 'user', fields: ['mySchemaIds'] },
  ];

  async function cleanup() {
    await prisma.note.deleteMany({ where: { userId: USER } });
    await prisma.user.deleteMany({ where: { id: USER } });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await cleanup();
    const a = cryptoUnder(KEY_A);
    await prisma.user.create({
      data: {
        id: USER,
        firstName: 'enc-readable-e2e',
        mySchemaIds: a.encryptJson(['abandonment', 'mistrust']) as string,
      },
    });
    await prisma.note.create({
      data: { userId: USER, date: '2026-10-16', text: a.encrypt(TEXT) },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  const readRows = async () => ({
    user: (await prisma.user.findUnique({
      where: { id: USER },
      select: { mySchemaIds: true },
    })) as { mySchemaIds: unknown },
    note: (await prisma.note.findFirst({
      where: { userId: USER },
    })) as { text: string },
  });

  it('драйвер отдаёт Json-колонку с шифротекстом строкой (шов, на котором держится ветка decryptRecord)', async () => {
    const { user } = await readRows();
    expect(typeof user.mySchemaIds).toBe('string');
  });

  it('под ключом B: Json-список → [] с маркером, а не base64-строка', async () => {
    const b = cryptoUnder(KEY_B);
    const { user } = await readRows();
    const row = b.decryptRecord(user, { jsonArrays: ['mySchemaIds'] });
    expect(row.mySchemaIds).toEqual([]);
    expect(b.unreadableFields(row)).toEqual(['mySchemaIds']);
  });

  it('под ключом B: текст остаётся сырым значением (fail-open), но помечен', async () => {
    const b = cryptoUnder(KEY_B);
    const { note } = await readRows();
    const row = b.decryptRecord(note, { strings: ['text'] });
    expect(row.text).toBe(note.text);
    expect(row.text).not.toBe(TEXT);
    expect(b.unreadableFields(row)).toEqual(['text']);
  });

  it('под ключом A оба читаются без маркера (контроль сида)', async () => {
    const a = cryptoUnder(KEY_A);
    const { user, note } = await readRows();
    const u = a.decryptRecord(user, { jsonArrays: ['mySchemaIds'] });
    const n = a.decryptRecord(note, { strings: ['text'] });
    expect(u.mySchemaIds).toEqual(['abandonment', 'mistrust']);
    expect(n.text).toBe(TEXT);
    expect(a.unreadableFields(u)).toEqual([]);
    expect(a.unreadableFields(n)).toEqual([]);
  });

  it('проба под ключом B красная и называет обе колонки; под A (старые ключи на месте) зелёная', async () => {
    const red = await probeUnder(KEY_B, KEY_E2E)
      .encryptionReadableProbe(scoped(), { ENCRYPTION_KEY: KEY_B }, targets)
      .run();
    expect(red.ok).toBe(false);
    expect(red.detail).toContain('user.mySchemaIds 1 из 1');
    expect(red.detail).toContain('note.text 1 из 1');
    expect(red.detail).not.toContain(TEXT);

    const green = await probeUnder(KEY_A, KEY_E2E)
      .encryptionReadableProbe(scoped(), { ENCRYPTION_KEY: KEY_A }, targets)
      .run();
    expect(green.ok).toBe(true);
    expect(green.detail).toContain('проверено значений 2');
  });

  it('по всему TARGETS: каждая таблица читается драйвером (select/orderBy по pk сходятся со схемой)', async () => {
    // Юнит гоняет пробу на фейке, который примет любой select; ошибочный pk
    // или колонка в TARGETS всплыли бы только на проде. Красный ok здесь
    // допустим (в базе джобы строки других спеков), ошибок чтения — нет.
    const res = await probeUnder(KEY_E2E, KEY_A)
      .encryptionReadableProbe(prisma, { ENCRYPTION_KEY: KEY_E2E })
      .run();
    expect(res.detail).not.toContain('не удалось прочитать таблицы');
  });
});
