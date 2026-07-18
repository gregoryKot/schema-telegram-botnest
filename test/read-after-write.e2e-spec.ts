// E2E read-after-write smoke на РЕАЛЬНОМ Postgres (best-practice, 2026-07).
//
// Правило CLAUDE.md «Тесты» → read-after-write: если фича ПИШЕТ состояние в
// одном месте, а ЧИТАЕТ/показывает в другом — тестируй связку, а не только
// запись. Юнит-тесты с моками Prisma зелены даже когда карточку потом «не
// найти»: реальные баги живут на стыке (денормализация mySchemaIds ↔ наличие
// UserSchemaNote, шифрование ↔ расшифровка). Гоняется в CI-джобе `migrations`,
// где уже поднят Postgres и применены миграции.
import { PrismaService } from '../src/prisma/prisma.service';
import { NotesService } from '../src/bot/notes.service';
import { decryptRecord } from '../src/utils/crypto';

describe('read-after-write: карточка схемы (реальный Postgres)', () => {
  let prisma: PrismaService;
  let notes: NotesService;
  const userId = 999_000_000_001n;
  const schemaId = 'abandonment';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    notes = new NotesService(prisma);
    // Чистый старт: тестовый юзер мог остаться от прошлого прогона.
    await prisma.userSchemaNote.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.user.create({ data: { id: userId } });
  });

  afterAll(async () => {
    await prisma.userSchemaNote.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('сохранил карточку → читается обратно расшифрованной', async () => {
    await notes.upsertSchemaNote(userId, schemaId, {
      feelings: 'страх быть брошенным',
      triggers: 'партнёр задерживается',
    });

    const list = await notes.getSchemaNotes(userId);
    const found = list.find((n) => n.schemaId === schemaId);
    expect(found).toBeTruthy();
    expect(found?.feelings).toBe('страх быть брошенным');
    expect(found?.triggers).toBe('партнёр задерживается');
  });

  it('сохранение добавило схему в денормализованный профиль (mySchemaIds)', async () => {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { mySchemaIds: true },
    });
    const dec = decryptRecord(row as Record<string, unknown>, {
      jsonArrays: ['mySchemaIds'],
    });
    expect(dec.mySchemaIds).toContain(schemaId);
  });
});
