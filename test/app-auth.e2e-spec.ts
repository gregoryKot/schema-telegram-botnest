// e2e SMOKE (TEST_COVERAGE_PLAN.md, этап 1 п.7): проверки, которые юнит-тесты
// структурно не могут дать — реальный AppModule собран целиком (все модули,
// контроллеры, гарды), крутится настоящий HTTP-стек Nest поверх supertest.
// Подменены только PrismaService (in-memory фейк, test/e2e-support/fake-prisma.ts)
// и TELEGRAF_BOT (no-op стаб, test/e2e-support/fake-bot.ts) — бот не должен
// стучаться в Telegram, а Prisma — в реальный Postgres. ValidationPipe,
// TelegramAuthGuard, ExceptionFilter'ы — настоящие (см. build-test-app.ts,
// зеркалит src/main.ts).
//
// Этот файл: (1) guard реально примонтирован на защищённых роутах —
// запрос без токена получает 401, а не проходит; (2) глобальный
// ValidationPipe({ whitelist: true, transform: true }) реально применён —
// незадекларированные поля DTO срезаются, а не долетают до сервиса/БД, и
// невалидный тип поля роняет запрос 400-кой ДО контроллера.
//
// НЕ покрыто этим смоуком: helmet/CORS/редиректы доменов/ServeStatic (не
// участвуют в проверяемых инвариантах), initData-путь TelegramAuthGuard
// (Bearer JWT покрывает тот же guard целиком — оба пути объединены в одном
// canActivate), миграции/реальный Postgres (см. джобу `migrations` в CI).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';

describe('e2e smoke: guard mounted + ValidationPipe (app-auth)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  const secret = () => process.env.JWT_SECRET as string;

  describe('TelegramAuthGuard реально примонтирован', () => {
    it('GET /api/schema-notes без токена/initData → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/schema-notes');
      expect(res.status).toBe(401);
    });

    it('POST /api/schema-notes без токена → 401 (не пишет в БД)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/schema-notes')
        .send({ schemaId: 'abandonment', triggers: 'x' });
      expect(res.status).toBe(401);
      expect(prisma.userSchemaNote._rows).toHaveLength(0);
    });

    it('с валидным Bearer JWT → проходит (не 401)', async () => {
      const token = signAccessToken(555n, secret());
      const res = await request(app.getHttpServer())
        .get('/api/schema-notes')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).not.toBe(401);
    });
  });

  describe('ValidationPipe({ whitelist: true, transform: true }) реально глобален', () => {
    const token = () => signAccessToken(777n, secret());

    it('лишнее недекорированное поле — срезается whitelist, не 400 (нет forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/schema-notes')
        .set('Authorization', `Bearer ${token()}`)
        .send({
          schemaId: 'abandonment',
          triggers: 'trigger text',
          junkField: 'must not reach prisma or service',
        });

      expect(res.status).toBeLessThan(300);
      const stored = prisma.userSchemaNote._rows.find(
        (r: any) => r.userId === 777n,
      );
      expect(stored).toBeDefined();
      // Ключевая проверка: поле, которого нет в SchemaNoteDto, не долетело
      // ни до сервиса, ни до "БД" — whitelist реально работает на живом
      // HTTP-запросе, а не только в юнит-тесте самого DTO.
      expect(stored.junkField).toBeUndefined();
    });

    it('невалидный тип поля (schemaId: number вместо string) → 400 ДО контроллера', async () => {
      const before = prisma.userSchemaNote._rows.length;
      const res = await request(app.getHttpServer())
        .post('/api/schema-notes')
        .set('Authorization', `Bearer ${token()}`)
        .send({ schemaId: 12345 });

      expect(res.status).toBe(400);
      // Не создало запись — упало на пайпе, не долетело до NotesService.
      expect(prisma.userSchemaNote._rows.length).toBe(before);
    });

    it('отсутствующее обязательное поле (text DTO) → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/mode-notes')
        .set('Authorization', `Bearer ${token()}`)
        .send({ triggers: 'no modeId here' });

      expect(res.status).toBe(400);
    });
  });
});
