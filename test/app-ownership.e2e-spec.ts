// e2e SMOKE (TEST_COVERAGE_PLAN.md, этап 1 п.7) — продолжение app-auth.e2e-spec.ts.
// Тот же AppModule/build-test-app.ts (см. заголовок соседнего файла для деталей
// того, что подменено и что не покрыто).
//
// Этот файл: (3) ownership-изоляция через реальный HTTP-стек — пользователь B
// не видит карточки пользователя A через тот же GET-эндпоинт, при том что
// фильтрация по userId происходит внутри NotesService (WHERE userId), а не
// на уровне ответа; (4) BigInt→number сериализация ответа не падает и не
// путает пользователей (userId в ответе — number, соответствующий владельцу).
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';

describe('e2e smoke: ownership isolation + BigInt serialization (app-ownership)', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  const secret = () => process.env.JWT_SECRET as string;
  const USER_A = 1_000_000_000_000_001n;
  const USER_B = 1_000_000_000_000_002n;

  it('User B не видит schema-notes пользователя A (изоляция по userId в HTTP-ответе)', async () => {
    const tokenA = signAccessToken(USER_A, secret());
    const tokenB = signAccessToken(USER_B, secret());

    const create = await request(app.getHttpServer())
      .post('/api/schema-notes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ schemaId: 'abandonment', triggers: 'секрет пользователя A' });
    expect(create.status).toBeLessThan(300);

    const asOwner = await request(app.getHttpServer())
      .get('/api/schema-notes')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(asOwner.status).toBe(200);
    expect(asOwner.body).toHaveLength(1);
    expect(asOwner.body[0].schemaId).toBe('abandonment');

    const asOther = await request(app.getHttpServer())
      .get('/api/schema-notes')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(asOther.status).toBe(200);
    // Ключевая проверка: чужая карточка не протекает через список другого
    // пользователя — фильтрация по userId реально дошла до ответа HTTP, а
    // не только до аргумента вызова fake-prisma в юнит-тесте сервиса.
    expect(asOther.body).toHaveLength(0);

    // Sanity: fake-prisma действительно хранит обе строки под разными
    // userId — изоляция проверена на уровне ответа API, а не потому что
    // данных попросту не было.
    expect(prisma.userSchemaNote._rows).toHaveLength(1);
    expect(prisma.userSchemaNote._rows[0].userId).toBe(USER_A);
  });

  it('User B не может достучаться до mode-notes пользователя A тем же путём', async () => {
    const tokenA = signAccessToken(USER_A, secret());
    const tokenB = signAccessToken(USER_B, secret());

    await request(app.getHttpServer())
      .post('/api/mode-notes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ modeId: 'vulnerable_child', triggers: 'секрет A' });

    const asOther = await request(app.getHttpServer())
      .get('/api/mode-notes')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(asOther.status).toBe(200);
    expect(asOther.body).toHaveLength(0);
  });

  it('BigInt userId сериализуется в JSON-ответе как number, привязанный к владельцу', async () => {
    const owner = 2_000_000_000_000_003n;
    const token = signAccessToken(owner, secret());

    await request(app.getHttpServer())
      .post('/api/schema-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ schemaId: 'defectiveness', triggers: 'bigint sanity' });

    const res = await request(app.getHttpServer())
      .get('/api/schema-notes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const row = res.body.find((r: any) => r.schemaId === 'defectiveness');
    expect(row).toBeDefined();
    // main.ts патчит BigInt.prototype.toJSON → Number(this); без этого
    // JSON.stringify на объекте с полем-BigInt бросает TypeError и запрос
    // упал бы 500-кой ещё до вопроса про owner-изоляцию.
    expect(typeof row.userId).toBe('number');
    expect(row.userId).toBe(Number(owner));
  });
});
