// E2E read-after-write smoke на РЕАЛЬНОМ Postgres (best-practice, 2026-07).
//
// Правило CLAUDE.md «Тесты» → read-after-write: если фича ПИШЕТ состояние в
// одном месте, а ЧИТАЕТ/показывает в другом — тестируй связку, а не только
// запись. Юнит-тесты с моками Prisma зелены даже когда карточку потом «не
// найти»: реальные баги живут на стыке (денормализация mySchemaIds ↔ наличие
// UserSchemaNote, шифрование ↔ расшифровка). Гоняется в CI-джобе `migrations`,
// где уже поднят Postgres и применены миграции.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotesService } from '../src/bot/notes.service';
import { decryptRecord } from '../src/utils/crypto';
import { buildRealDbTestApp } from './e2e-support/build-real-db-test-app';
import { signAccessToken } from './e2e-support/jwt';

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

// Карточка режима донабрала origins/healthyView (зеркало карточки схемы).
// Проверяем связку именно ЧЕРЕЗ HTTP (POST → GET /api/mode-notes), а не
// только на уровне сервиса: guard/ValidationPipe/сериализация ответа —
// отдельный слой, где юнит-тест сервиса баг не поймает.
describe('read-after-write: карточка режима через HTTP, реальный Postgres (origins/healthyView)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userId = 999_000_000_002n;
  const modeId = 'vulnerable_child';
  const token = () => signAccessToken(userId, process.env.JWT_SECRET as string);

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
    await prisma.userModeNote.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.user.create({ data: { id: userId } });
  });

  afterAll(async () => {
    await prisma.userModeNote.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('POST /api/mode-notes с origins/healthyView → GET возвращает те же значения', async () => {
    const save = await request(app.getHttpServer())
      .post('/api/mode-notes')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        modeId,
        origins: 'так реагировали в детстве',
        healthyView: 'сейчас я в безопасности',
      });
    expect(save.status).toBeLessThan(300);

    const list = await request(app.getHttpServer())
      .get('/api/mode-notes')
      .set('Authorization', `Bearer ${token()}`);
    expect(list.status).toBe(200);
    const found = list.body.find(
      (n: { modeId: string }) => n.modeId === modeId,
    );
    expect(found?.origins).toBe('так реагировали в детстве');
    expect(found?.healthyView).toBe('сейчас я в безопасности');

    // Инвариант «заполнил карточку ⇒ она в коллекции» не сломался (правило
    // CLAUDE.md «Тесты», read-after-write) — myModeIds денормализован в User.
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { myModeIds: true },
    });
    const dec = decryptRecord(row as Record<string, unknown>, {
      jsonArrays: ['myModeIds'],
    });
    expect(dec.myModeIds).toContain(modeId);
  });
});
