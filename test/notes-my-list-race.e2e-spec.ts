// E15 (аудит 2026-11): «мои схемы» (User.mySchemaIds) — зашифрованный список,
// и карточка дописывает в него свой id read-modify-write'ом. В транзакции
// READ COMMITTED две карточки одного юзера, сохранённые одновременно, читали
// список до чужой записи, и вторая запись стирала id первой: карточка есть,
// а в «Моих схемах» её нет. Теперь addToMyList берёт замок строки
// пользователя (SELECT … FOR UPDATE, src/bot/notes-my-list.ts).
// Замок — свойство Postgres, а не нашего кода: фейк ответит что угодно, поэтому
// спек гоняется только на живой базе (E2E_REAL_DB=1, джоба `migrations`,
// правило №18). Путь — продуктовый: NotesService, как его зовёт POST /api/schema-notes.
import { INestApplication } from '@nestjs/common';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { BotService } from '../src/bot/bot.service';
import { NotesService } from '../src/bot/notes.service';
import { addToMyList } from '../src/bot/notes-my-list';

const REAL_DB = process.env.E2E_REAL_DB === '1';
const describeOnRealDb = REAL_DB ? describe : describe.skip;

describeOnRealDb(
  'e2e: параллельные карточки не теряют id в «моих схемах»',
  () => {
    let app: INestApplication;
    let prisma: TestApp['prisma'];
    const U = 1_000_000_000_000_951n;
    const SCHEMAS = [
      'abandonment',
      'mistrust',
      'emotional_deprivation',
      'defectiveness',
      'social_isolation',
      'dependence',
    ];

    beforeAll(async () => {
      ({ app, prisma } = await buildTestApp());
    });
    afterAll(async () => {
      await cleanupOwnershipFixtures(prisma, [U]);
      await app.close();
    });
    beforeEach(async () => {
      await cleanupOwnershipFixtures(prisma, [U]);
      await prisma.user.create({ data: { id: U } });
    });

    const mySchemas = async () =>
      (await app.get(BotService).getUserSettings(U))?.mySchemaIds ?? [];

    it('шесть карточек одновременно — все шесть id в списке', async () => {
      const notes = app.get(NotesService);
      await Promise.all(
        SCHEMAS.map((id) => notes.upsertSchemaNote(U, id, { triggers: id })),
      );
      expect([...(await mySchemas())].sort()).toEqual([...SCHEMAS].sort());
    });

    it('повтор того же id параллельно не дублирует его', async () => {
      await Promise.all(
        [1, 2, 3, 4].map(() =>
          addToMyList(prisma, U, 'mySchemaIds', 'mistrust'),
        ),
      );
      expect(await mySchemas()).toEqual(['mistrust']);
    });
  },
);
