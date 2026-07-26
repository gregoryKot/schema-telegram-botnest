// e2e SMOKE публичных эндпоинтов мини-тестов («тесты без регистрации»).
// Юнит-тесты не могут поймать «guard всё-таки примонтирован и режет анонима»
// или «ValidationPipe не применён» — здесь собран настоящий AppModule.
//
// Ownership-среза у этих роутов нет намеренно: они не читают пользовательских
// данных (контент статический, событие пишется анонимно с userId = null) —
// поэтому смоук проверяет обратный инвариант: доступ БЕЗ авторизации работает,
// а мусор режется DTO/санитизацией.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';

describe('e2e smoke: публичные мини-тесты', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/quizzes отдаёт контент анониму (без токена/initData)', async () => {
    const res = await request(app.getHttpServer()).get('/api/quizzes');
    expect(res.status).toBe(200);
    expect(res.body.quizzes.map((q: any) => q.id)).toEqual([
      'drives',
      'critic',
      'battery',
    ]);
    expect(res.body.quizzes[0].questions.length).toBeGreaterThan(0);
  });

  it('GET /api/quizzes?form=vy отдаёт «вы»-контент', async () => {
    const res = await request(app.getHttpServer()).get('/api/quizzes?form=vy');
    expect(res.status).toBe(200);
    const critic = res.body.quizzes.find((q: any) => q.id === 'critic');
    expect(critic.title).toContain('ваш');
  });

  it('POST /api/public-event пишет анонимное событие (userId = null)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/public-event')
      .send({
        name: 'quiz_completed',
        meta: { quiz: 'drives', result: 'adult', src: 'bot', junk: 'x' },
      });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    const rows = prisma.analyticsEvent._rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBeNull();
    expect(rows[0].name).toBe('quiz_completed');
    // src подменить нельзя, лишние поля срезаны санитизацией.
    expect(rows[0].meta).toEqual({
      quiz: 'drives',
      result: 'adult',
      src: 'web',
    });
  });

  it('POST /api/public-event не принимает НЕ-публичные события (400 от DTO)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/public-event')
      .send({ name: 'share_card', meta: { kind: 'weekly' } });
    expect(res.status).toBe(400);
  });

  it('авторизованный POST /api/event по-прежнему требует токен (401 анониму)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/event')
      .send({ name: 'journey_open' });
    expect(res.status).toBe(401);
  });
});
