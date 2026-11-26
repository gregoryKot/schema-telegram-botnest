// Аудит 2026-10-11, «Долг с механизмом»: UNIQUE_RULES не сверялись со схемой.
// Статическая сверка с текстом schema.prisma — src/auth/unique-rules-registry.spec.ts.
// Здесь — то, чего текст схемы не покажет, на живом Postgres (правило №18):
//  (а) констрейнты, реально созданные миграциями (pg_index), равны UNIQUE_RULES —
//      в том числе unique-индекс, добавленный рукописным SQL мимо schema.prisma;
//  (б) настоящий merge с коллизией по КАЖДОЙ таблице из правил не падает 23505,
//      побеждает target (в объединяемых таблицах — пара сливается), несвязанная
//      строка source переезжает;
//  (в) R3 (аудит 2026-11): записи с одним ключом в обоих аккаунтах, сохранённые
//      настоящими сервисами (шифротекст), после merge читаются у target обе.
// Мок $executeRaw не доказывает ни того, ни другого. Гоняется только при
// E2E_REAL_DB=1 (джоба `migrations`).
import { INestApplication } from '@nestjs/common';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { UNIQUE_FIXTURES } from './e2e-support/unique-rule-fixtures';
import {
  MergeService,
  UNIQUE_RULES,
  USER_OWNED_TABLES,
  SECURITY_SENSITIVE_TABLES,
} from '../src/auth/merge.service';
import { COMBINE_TABLES } from '../src/auth/merge-combine';
import { LOST_ON_CONFLICT, LOST_UNSHOWN } from '../src/auth/merge-lost';
import { BotService } from '../src/bot/bot.service';
import { DiaryService } from '../src/bot/diary.service';
import { NotesService } from '../src/bot/notes.service';
import { ExercisesService } from '../src/bot/exercises.service';
import { YsqService } from '../src/bot/ysq.service';

const REAL_DB = process.env.E2E_REAL_DB === '1';
const describeOnRealDb = REAL_DB ? describe : describe.skip;

type CatalogRow = { table: string; cols: string[]; special: boolean };

describeOnRealDb('e2e: UNIQUE_RULES против живого Postgres', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  const SRC = 770_000_911n;
  const TGT = 1_000_000_000_000_911n;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    prisma = built.prisma;
  });
  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, [SRC, TGT]);
    await app.close();
  });
  beforeEach(async () => {
    await cleanupOwnershipFixtures(prisma, [SRC, TGT]);
    await prisma.user.create({ data: { id: SRC } });
    await prisma.user.create({ data: { id: TGT } });
  });

  /** Уникальные индексы со userId среди ведущих колонок (INCLUDE не считается). */
  async function catalog(): Promise<CatalogRow[]> {
    return prisma.$queryRaw`
      SELECT c.relname::text AS "table",
             array_agg(a.attname::text ORDER BY k.ord) AS cols,
             bool_or(i.indpred IS NOT NULL OR i.indexprs IS NOT NULL) AS special
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
       WHERE i.indisunique AND c.relkind = 'r'
         AND n.nspname = current_schema() AND k.ord <= i.indnkeyatts
       GROUP BY c.relname, i.indexrelid
      HAVING bool_or(a.attname = 'userId')`;
  }
  const key = (table: string, cols: string[]) =>
    `${table}[${cols
      .filter((c) => c !== 'userId')
      .sort()
      .join(',')}]`;

  it('констрейнты в базе (после migrate deploy) = UNIQUE_RULES', async () => {
    const rows = await catalog();
    // sanity: current_schema() не промахнулся, запрос что-то видит.
    expect(rows.length).toBeGreaterThanOrEqual(UNIQUE_RULES.length);

    const special = rows.filter((r) => r.special).map((r) => r.table);
    expect({
      'частичный/выражение-индекс со userId: для него нужно отдельное правило merge, а не строка в UNIQUE_RULES':
        special,
    }).toEqual({
      'частичный/выражение-индекс со userId: для него нужно отдельное правило merge, а не строка в UNIQUE_RULES':
        [],
    });

    const known = new Set<string>([
      ...USER_OWNED_TABLES,
      ...SECURITY_SENSITIVE_TABLES,
    ]);
    const sensitive = new Set<string>(SECURITY_SENSITIVE_TABLES);
    const ruled = rows.filter((r) => !sensitive.has(r.table));
    expect(rows.map((r) => r.table).filter((t) => !known.has(t))).toEqual([]);
    expect(ruled.map((r) => key(r.table, r.cols)).sort()).toEqual(
      UNIQUE_RULES.map((r) => key(r.table, r.cols)).sort(),
    );
  });

  it('фикстуры покрывают все правила', () => {
    expect(UNIQUE_FIXTURES.map((f) => f.table).sort()).toEqual(
      UNIQUE_RULES.map((r) => r.table).sort(),
    );
  });

  const combined = (t: string) => COMBINE_TABLES.includes(t);

  it.each(UNIQUE_FIXTURES.filter((f) => !combined(f.table)))(
    '$table: коллизия по ключу — target побеждает, чужой ключ source переезжает, 23505 нет',
    async ({ table, delegate, data, markOf }) => {
      const cols = UNIQUE_RULES.find((r) => r.table === table)!.cols;
      const d = prisma[delegate];
      const tgtRow = await d.create({ data: data(TGT, 'a', '22') });
      await d.create({ data: data(SRC, 'a', '11') }); // коллизия
      let otherMark: string | undefined;
      if (cols.length > 0) {
        const other = await d.create({ data: data(SRC, 'b', '33') });
        otherMark = markOf(other);
      }
      // Сводка до merge считает ровно то, что удалит DELETE…EXISTS (merge-lost.ts).
      const shown = table in LOST_ON_CONFLICT;
      expect(shown || table in LOST_UNSHOWN).toBe(true);
      const { lost } = await app.get(MergeService).summarize(SRC, TGT);
      expect(lost).toEqual(shown ? { [table]: 1 } : {});

      await app.get(MergeService).merge(SRC, TGT); // не бросает 23505

      const rows = await d.findMany({ where: { userId: TGT } });
      const marks = rows.map(markOf).sort();
      const expected = [
        markOf(tgtRow),
        ...(otherMark ? [otherMark] : []),
      ].sort();
      expect(marks).toEqual(expected);
      expect(await d.count({ where: { userId: SRC } })).toBe(0);
      expect(await prisma.user.findUnique({ where: { id: SRC } })).toBeNull();
    },
  );

  // Объединяемые таблицы: строки фикстур пишутся без шифрования, поэтому здесь
  // только «не падает, пара — одна строка, чужой ключ переехал»; содержимое
  // проверяет блок R3 ниже, на строках, записанных сервисами.
  it.each(UNIQUE_FIXTURES.filter((f) => combined(f.table)))(
    '$table: коллизия по ключу — пара сливается в одну строку, 23505 нет',
    async ({ table, delegate, data }) => {
      const cols = UNIQUE_RULES.find((r) => r.table === table)!.cols;
      const d = prisma[delegate];
      await d.create({ data: data(TGT, 'a', '22') });
      await d.create({ data: data(SRC, 'a', '11') });
      if (cols.length > 0) await d.create({ data: data(SRC, 'b', '33') });

      await app.get(MergeService).merge(SRC, TGT);

      expect(await d.count({ where: { userId: TGT } })).toBe(
        cols.length > 0 ? 2 : 1,
      );
      expect(await d.count({ where: { userId: SRC } })).toBe(0);
    },
  );
});

describeOnRealDb('e2e: R3 — слияние объединяет записи с одним ключом', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  const SRC = 770_000_912n;
  const TGT = 1_000_000_000_000_912n;
  const D = '2026-03-01';
  // Шаг времени между записями: «свежее» не должно решаться совпадением мс.
  const tick = () => new Promise((r) => setTimeout(r, 5));

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    prisma = built.prisma;
  });
  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, [SRC, TGT]);
    await app.close();
  });
  beforeEach(async () => {
    await cleanupOwnershipFixtures(prisma, [SRC, TGT]);
    await prisma.user.create({ data: { id: SRC } });
    await prisma.user.create({ data: { id: TGT } });
  });

  it('сохранил в обоих аккаунтах → у target текст обоих, пункты обоих, заполненные поля', async () => {
    const bot = app.get(BotService);
    const diary = app.get(DiaryService);
    const notes = app.get(NotesService);
    const ex = app.get(ExercisesService);
    const ysq = app.get(YsqService);
    await bot.saveNote(TGT, D, 'Устала', ['work']);
    await bot.saveNote(SRC, D, 'Поспала днём', ['sleep']);
    await diary.upsertGratitudeDiaryEntry(TGT, D, ['чай']);
    await diary.upsertGratitudeDiaryEntry(SRC, D, ['звонок', 'чай']);
    await notes.upsertSchemaNote(TGT, 'abandonment', { triggers: 'уходят' });
    await notes.upsertSchemaNote(SRC, 'abandonment', {
      triggers: 'молчат',
      feelings: 'страх',
    });
    await notes.upsertModeNote(TGT, 'vulnerable-child', { fear: 'один' });
    await notes.upsertModeNote(SRC, 'vulnerable-child', { alias: 'Малыш' });
    await ex.upsertSafePlace(TGT, 'море');
    await ysq.saveYsqResult(TGT, [1, 1]);
    await tick();
    await ex.upsertSafePlace(SRC, 'лес');
    await ysq.saveYsqResult(SRC, [5, 5]);
    // Предусловие шва: в колонке — шифротекст, не открытый текст.
    const raw = await prisma.note.findFirst({ where: { userId: SRC } });
    expect(raw?.text).not.toContain('Поспала');

    const merge = app.get(MergeService);
    expect((await merge.summarize(SRC, TGT)).combined).toBe(6);
    await merge.merge(SRC, TGT);

    expect(await bot.getNote(TGT, D)).toEqual({
      text: 'Устала\n\nПоспала днём',
      tags: ['work', 'sleep'],
    });
    const [day] = await diary.getGratitudeDiaryEntries(TGT);
    // Без повтора «чай»; «звонок» встал перед ним — как стоял у source.
    expect(day.items).toEqual(['звонок', 'чай']);
    const card = await notes.getSchemaNote(TGT, 'abandonment');
    expect([card?.triggers, card?.feelings]).toEqual(['уходят', 'страх']);
    const mode = await notes.getModeNote(TGT, 'vulnerable-child');
    expect([mode?.alias, mode?.fear]).toEqual(['Малыш', 'один']);
    expect((await ex.getSafePlace(TGT))?.description).toBe('лес');
    expect((await ysq.getYsqResult(TGT))?.answers).toEqual([5, 5]);
    const history = await ysq.getYsqHistory(TGT);
    expect(history.map((h) => h.answers)).toEqual([
      [5, 5],
      [1, 1],
    ]);
  });

  it('прежний итог теста без строки истории (до её появления) — уходит в историю', async () => {
    const ysq = app.get(YsqService);
    await ysq.saveYsqResult(TGT, [1, 1]);
    await prisma.ysqResultHistory.deleteMany({ where: { userId: TGT } });
    await tick();
    await ysq.saveYsqResult(SRC, [5, 5]);

    await app.get(MergeService).merge(SRC, TGT);

    const history = await ysq.getYsqHistory(TGT);
    expect(history.map((h) => h.answers)).toEqual([
      [5, 5],
      [1, 1],
    ]);
  });

  it('нечитаемый шифротекст у target — merge проходит, target не перезаписан', async () => {
    const foreign = Buffer.alloc(40, 7).toString('base64');
    await prisma.note.create({ data: { userId: TGT, date: D, text: foreign } });
    await app.get(BotService).saveNote(SRC, D, 'Поспала днём');

    await app.get(MergeService).merge(SRC, TGT);

    const row = await prisma.note.findFirst({ where: { userId: TGT } });
    expect(row?.text).toBe(foreign);
    expect(await prisma.note.count({ where: { userId: SRC } })).toBe(0);
  });
});
