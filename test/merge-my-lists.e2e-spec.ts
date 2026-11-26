// backend#0 (аудит 2026-10-11): слияние аккаунтов («Привязать Telegram») теряло
// «мои схемы» и «мои режимы». User.mySchemaIds/myModeIds в колонке — шифротекст
// (FIELD_POLICY.User → enc), а правило union видело две строки вместо массивов.
// Юнит был зелёным: фикстуры — plaintext-массивы, которых в колонке не бывает.
// Здесь — настоящая БД, настоящие NotesService/BotService/MergeService и
// ENCRYPTION_KEY (test/setup-e2e.ts): карточки пишутся тем путём, каким их пишет
// продукт, читается список тем путём, каким его читает продукт.
// Гоняется только на живом Postgres (E2E_REAL_DB=1, джоба `migrations`): merge —
// сырой SQL, фейк его не исполнит (правило №18).
import { INestApplication } from '@nestjs/common';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { MergeService } from '../src/auth/merge.service';
import { BotService } from '../src/bot/bot.service';
import { NotesService } from '../src/bot/notes.service';

const REAL_DB = process.env.E2E_REAL_DB === '1';
const describeOnRealDb = REAL_DB ? describe : describe.skip;

describeOnRealDb('e2e: слияние аккаунтов сохраняет «мои схемы/режимы»', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  // Телеграмный номер (ниже веб-диапазона) и веб-номер — как в проде.
  const TG = 770_000_901n;
  const WEB = 1_000_000_000_000_901n;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    prisma = built.prisma;
  });
  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, [TG, WEB]);
    await app.close();
  });
  beforeEach(async () => {
    await cleanupOwnershipFixtures(prisma, [TG, WEB]);
    await prisma.user.create({ data: { id: TG } });
    await prisma.authProvider.create({
      data: { userId: TG, provider: 'telegram', providerId: String(TG) },
    });
    await prisma.user.create({ data: { id: WEB } });
  });

  const lists = async (userId: bigint) => {
    const s = await app.get(BotService).getUserSettings(userId);
    return { schemas: s?.mySchemaIds ?? [], modes: s?.myModeIds ?? [] };
  };
  /** Инвариант notes.service.ts: карточка ⇒ её id в списке профиля. */
  async function expectCardsInLists(userId: bigint) {
    const [cards, modeCards, l] = await Promise.all([
      prisma.userSchemaNote.findMany({ where: { userId } }),
      prisma.userModeNote.findMany({ where: { userId } }),
      lists(userId),
    ]);
    expect(l.schemas).toEqual(
      expect.arrayContaining(cards.map((c) => c.schemaId)),
    );
    expect(l.modes).toEqual(
      expect.arrayContaining(modeCards.map((c) => c.modeId)),
    );
  }

  it('карточки у source, пустой target → после merge список target содержит id (в колонке — шифр)', async () => {
    const notes = app.get(NotesService);
    await notes.upsertSchemaNote(TG, 'abandonment', { triggers: 'уходят' });
    await notes.upsertSchemaNote(TG, 'mistrust', { triggers: 'обещают' });
    await notes.upsertModeNote(TG, 'vulnerable-child', { triggers: 'один' });
    // Предусловие шва: в колонке source действительно строка-шифротекст.
    const raw = await prisma.user.findUnique({
      where: { id: TG },
      select: { mySchemaIds: true },
    });
    expect(typeof raw?.mySchemaIds).toBe('string');

    await app.get(MergeService).merge(TG, WEB);

    const l = await lists(WEB);
    expect([...l.schemas].sort()).toEqual(['abandonment', 'mistrust']);
    expect(l.modes).toEqual(['vulnerable-child']);
    // Результат записан тем же способом, что и продуктом: шифротекстом.
    const after = await prisma.user.findUnique({
      where: { id: WEB },
      select: { mySchemaIds: true, myModeIds: true },
    });
    expect(typeof after?.mySchemaIds).toBe('string');
    expect(typeof after?.myModeIds).toBe('string');
    await expectCardsInLists(WEB);
  });

  it('пересечение: список target не затирается, ничто не теряется, дублей нет', async () => {
    const notes = app.get(NotesService);
    await notes.upsertSchemaNote(TG, 'abandonment', { triggers: 'a' });
    await notes.upsertSchemaNote(TG, 'failure', { triggers: 'b' });
    await notes.upsertModeNote(TG, 'vulnerable-child', { triggers: 'c' });
    await notes.upsertSchemaNote(WEB, 'failure', { triggers: 'своя' });
    await notes.upsertSchemaNote(WEB, 'mistrust', { triggers: 'своя' });
    await notes.upsertModeNote(WEB, 'angry-child', { triggers: 'своя' });

    await app.get(MergeService).merge(TG, WEB);

    const l = await lists(WEB);
    expect([...l.schemas].sort()).toEqual([
      'abandonment',
      'failure',
      'mistrust',
    ]);
    expect([...l.modes].sort()).toEqual(['angry-child', 'vulnerable-child']);
    // Карточка target при коллизии (failure) осталась своей, не source.
    const failure = await notes.getSchemaNote(WEB, 'failure');
    expect(failure?.triggers).toBe('своя');
    await expectCardsInLists(WEB);
  });

  it('схема, выбранная без карточки (updateUserSettings), тоже переезжает', async () => {
    await app.get(BotService).updateUserSettings(TG, {
      mySchemaIds: ['defectiveness'],
    });
    await app.get(MergeService).merge(TG, WEB);
    expect((await lists(WEB)).schemas).toEqual(['defectiveness']);
  });

  it('пустой source не стирает список target', async () => {
    await app.get(BotService).updateUserSettings(WEB, {
      mySchemaIds: ['mistrust'],
    });
    await app.get(MergeService).merge(TG, WEB);
    expect((await lists(WEB)).schemas).toEqual(['mistrust']);
  });
});
