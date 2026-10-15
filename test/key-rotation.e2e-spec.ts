// Ротация ENCRYPTION_KEY на РЕАЛЬНОМ Postgres (правило №18; находки аудита
// 2026-10-11 r2-0#0..#2). Три слоя, каждый ловил свою дыру, и ни один не виден
// на моках:
//  - Prisma 7 не конструирует клиент без driver-adapter, а у userSafePlace и
//    diaryDraft нет колонки `id` — «Unknown field» бросает клиент Prisma, фейк
//    ответил бы что угодно;
//  - составной ключ DiaryDraft и Json-колонки с шифротекстом (YSQ answers)
//    обновляются только настоящим драйвером;
//  - код выхода и вывод ОТДЕЛЬНОГО процесса — то, что видит владелец в Amvera.
//
// Сценарий: по строке на КАЖДУЮ запись TARGETS, зашифрованной ключом A →
// rotateAll под (B, OLD=A) → каждое поле читается B и НЕ читается одним A;
// повторный прогон идемпотентен. Гоняется в CI-джобе `migrations`.
import { spawnSync } from 'child_process';
import { join } from 'path';
import { PrismaService } from '../src/prisma/prisma.service';
import { loadWithKeys } from '../src/test-support/load-with-keys';
import { TARGETS } from '../src/cli/rotate-encryption/targets';
import {
  BASE_ROWS,
  Row,
  THERAPIST,
  USER,
  whereOf,
} from './key-rotation-fixtures';

type CryptoModule = typeof import('../src/utils/crypto');
type RotateModule = typeof import('../src/cli/rotate-encryption/rotate-all');
type Delegate = {
  create(a: { data: Row }): Promise<Row>;
  findMany(a: { where: Row }): Promise<Row[]>;
  deleteMany(a: { where: Row }): Promise<unknown>;
};

const KEY_A = 'aa'.repeat(32);
const KEY_B = 'bb'.repeat(32);
const KEY_C = 'cc'.repeat(32);
// Ключ остальных e2e-спеков джобы (test/setup-e2e.ts): их недочищенные строки
// не должны выглядеть «нечитаемыми» для ротации.
const KEY_E2E = '0'.repeat(64);
const OLD = `${KEY_A},${KEY_E2E}`;

const cryptoUnder = (key: string, old?: string): CryptoModule =>
  loadWithKeys(
    { key, old },
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    () => require('../src/utils/crypto') as CryptoModule,
  );
const marker = (model: string, field: string) => `secret:${model}.${field}`;

describe('ротация ENCRYPTION_KEY на реальном Postgres', () => {
  let prisma: PrismaService;
  const dg = (name: string) =>
    (prisma as unknown as Record<string, Delegate>)[name];
  const created: Record<string, Row> = {};

  async function cleanup() {
    for (const t of TARGETS) {
      if (t.name === 'user' || !created[t.name]) continue;
      await dg(t.name).deleteMany({ where: whereOf(t, created[t.name]) });
    }
    // уникальные ключи фикстур (на случай оборванного прогона) + каскад пользователей
    await prisma.booking.deleteMany({
      where: { cancelToken: 'rot-e2e-booking' },
    });
    await prisma.subscription.deleteMany({
      where: { cancelToken: 'rot-e2e-sub' },
    });
    await prisma.clientMeeting.deleteMany({
      where: { clientKey: 'rot-e2e-client' },
    });
    await prisma.emailToken.deleteMany({
      where: { tokenHash: 'rot-e2e-token' },
    });
    await prisma.therapyRelation.deleteMany({
      where: { code: 'rot-e2e-code' },
    });
    await prisma.user.deleteMany({ where: { id: { in: [USER, THERAPIST] } } });
  }

  async function seedUnderKeyA() {
    const a = cryptoUnder(KEY_A);
    await prisma.user.createMany({
      data: [
        { id: THERAPIST, firstName: 'rot-e2e-therapist' },
        { id: USER, firstName: 'rot-e2e-user' },
      ],
    });
    for (const t of TARGETS) {
      const data: Row = { ...BASE_ROWS[t.name] };
      for (const f of t.fields) data[f] = a.encrypt(marker(t.name, f));
      if (t.name === 'clientConceptualization')
        data.history = [{ savedAt: '2026-10-14', goals: a.encrypt('история') }];
      if (t.name === 'user') {
        const { id, ...rest } = data;
        await prisma.user.update({ where: { id: id as bigint }, data: rest });
        created.user = { id };
        continue;
      }
      created[t.name] = await dg(t.name).create({ data });
    }
  }

  const rotateInProcess = () => {
    const m = loadWithKeys(
      { key: KEY_B, old: OLD },
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      () => require('../src/cli/rotate-encryption/rotate-all') as RotateModule,
    );
    return m.rotateAll(prisma);
  };

  // Что лежит в базе: читается ли новым ключом и перестало ли читаться старым.
  async function problemsAfterRotation(): Promise<string[]> {
    const onlyNew = cryptoUnder(KEY_B);
    const onlyOld = cryptoUnder(KEY_A);
    const problems: string[] = [];
    for (const t of TARGETS) {
      const [row] = await dg(t.name).findMany({
        where: whereOf(t, created[t.name]),
      });
      if (!row) {
        problems.push(`${t.name}: строка пропала`);
        continue;
      }
      for (const f of t.fields) {
        const v = row[f] as string;
        const want = marker(t.name, f);
        if (onlyNew.decrypt(v) !== want)
          problems.push(`${t.name}.${f}: новым ключом не читается`);
        if (onlyOld.decrypt(v) === want)
          problems.push(`${t.name}.${f}: всё ещё читается старым ключом`);
      }
    }
    const [conc] = await prisma.clientConceptualization.findMany({
      where: { id: created.clientConceptualization.id as string },
    });
    const goals = (conc.history as Array<Row>)[0].goals as string;
    if (onlyNew.decrypt(goals) !== 'история')
      problems.push('history: новым ключом не читается');
    if (onlyOld.decrypt(goals) === 'история')
      problems.push('history: всё ещё читается старым ключом');
    return problems;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await cleanup();
    await seedUnderKeyA();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('у каждой записи списка есть фикстура (новая запись без строки в спеке краснеет)', () => {
    expect(Object.keys(BASE_ROWS).sort()).toEqual(
      TARGETS.map((t) => t.name).sort(),
    );
  });

  it('до ротации поля читаются только ключом A (контроль сида)', async () => {
    const onlyNew = cryptoUnder(KEY_B);
    const [row] = await dg('userSafePlace').findMany({
      where: whereOf(
        TARGETS.find((t) => t.name === 'userSafePlace')!,
        created.userSafePlace,
      ),
    });
    expect(onlyNew.decrypt(row.description as string)).not.toBe(
      marker('userSafePlace', 'description'),
    );
  });

  it('rotateAll: все модели списка и история перешифрованы, ничего не упало', async () => {
    const report = await rotateInProcess();

    expect(report.failed).toEqual([]);
    expect(await problemsAfterRotation()).toEqual([]);
  });

  it('повторный прогон идемпотентен: ничего не падает, всё по-прежнему читается новым ключом', async () => {
    const report = await rotateInProcess();

    expect(report.failed).toEqual([]);
    expect(await problemsAfterRotation()).toEqual([]);
  });

  describe('отдельный процесс (точка входа, как в контейнере)', () => {
    const run = (env: Record<string, string>) =>
      spawnSync(
        process.execPath,
        [
          '-r',
          'ts-node/register/transpile-only',
          'src/cli/rotate-encryption-key.ts',
        ],
        {
          cwd: join(__dirname, '..'),
          env: { ...process.env, NODE_ENV: 'test', ...env },
          encoding: 'utf8',
          timeout: 120_000,
        },
      );

    it('без валидного ENCRYPTION_KEY — код 1 и понятное сообщение, база не тронута', () => {
      const r = run({ ENCRYPTION_KEY: 'не-ключ', ENCRYPTION_KEY_OLD: OLD });

      expect(r.status).toBe(1);
      expect(r.stderr).toContain(
        'Ротация прервана: ENCRYPTION_KEY не задан или не 64 hex-символа',
      );
    });

    it('новый ключ C, старые A и E2E: процесс завершается кодом 0 и «Готово», строки читаются ключом C', async () => {
      const r = run({
        ENCRYPTION_KEY: KEY_C,
        ENCRYPTION_KEY_OLD: `${KEY_B},${KEY_E2E}`,
      });

      expect(r.stdout).toContain('Готово: перешифровано строк');
      expect(r.status).toBe(0);
      const onlyC = cryptoUnder(KEY_C);
      const [row] = await prisma.userLetter.findMany({
        where: { id: created.userLetter.id as number },
      });
      expect(onlyC.decrypt(row.text)).toBe(marker('userLetter', 'text'));
    });

    it('значение под неизвестным ключом: код 1, «НЕ ротировано» и просьба не убирать старый ключ', async () => {
      const stranger = cryptoUnder(KEY_A);
      const note = await prisma.note.create({
        data: {
          userId: USER,
          date: '2026-10-13',
          text: stranger.encrypt('чужой ключ'),
        },
      });
      try {
        // ключ A процессу не передаём: текущий C, старый только B
        const r = run({
          ENCRYPTION_KEY: KEY_C,
          ENCRYPTION_KEY_OLD: `${KEY_B},${KEY_E2E}`,
        });

        expect(r.status).toBe(1);
        expect(r.stdout).toContain(
          'НЕ ротировано: [note (не расшифровалось: 1)]',
        );
        expect(r.stdout).toContain('ENCRYPTION_KEY_OLD НЕ убирать');
      } finally {
        await prisma.note.delete({ where: { id: note.id } });
      }
    });
  });
});
