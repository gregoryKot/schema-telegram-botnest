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
import { QUIZ_IDS } from '../src/quiz/quiz-registry';

describe('e2e smoke: публичные мини-тесты', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  // Анонимное событие пишется с userId = null, поэтому опознаём его по
  // сочетанию имени и meta, а не по владельцу. Чистка нужна для реального
  // Postgres (E2E_REAL_DB=1): без неё второй прогон найдёт две строки вместо
  // одной и упадёт на ровном месте.
  const EVENT_NAME = 'quiz_completed';
  const clearEvents = () =>
    prisma.analyticsEvent.deleteMany({
      where: { userId: null, name: EVENT_NAME },
    });

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await clearEvents();
  });

  afterAll(async () => {
    await clearEvents();
    await app.close();
  });

  it('GET /api/quizzes отдаёт контент анониму (без токена/initData)', async () => {
    const res = await request(app.getHttpServer()).get('/api/quizzes');
    expect(res.status).toBe(200);
    // Сверка с реестром: новый тест обязан доехать до анонимной выдачи, но
    // список-копию здесь править на каждый тест незачем.
    expect(res.body.quizzes.map((q: any) => q.id)).toEqual([...QUIZ_IDS]);
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
    // Читаем настоящим запросом, а не из внутреннего массива фейка — то же
    // утверждение обязано работать и на живом Postgres.
    const rows = await prisma.analyticsEvent.findMany({
      where: { userId: null, name: EVENT_NAME },
    });
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

  // Аудит 2026-10, frontends#5: форма записи на визитке показывает кризисную
  // карточку посетителю БЕЗ входа, а /api/event ему закрыт (401). Событие
  // показа идёт анонимным путём — только с surface=booking.
  it('POST /api/public-event: показ кризисной карточки записи пишется анонимно, чужой surface дропается', async () => {
    const where = { userId: null, name: 'crisis_card_shown' };
    const before = await prisma.analyticsEvent.count({ where });
    const send = (meta: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post('/api/public-event')
        .send({ name: 'crisis_card_shown', meta });

    const ok = await send({ surface: 'booking', text: 'не хочу жить' });
    expect(ok.status).toBe(201);
    const foreign = await send({ surface: 'note' }); // авторизованный экран
    expect(foreign.status).toBe(201); // молча: аноним не оракул
    expect(foreign.body).toEqual({ ok: true });

    expect(await prisma.analyticsEvent.count({ where })).toBe(before + 1);
    const [row] = await prisma.analyticsEvent.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 1,
    });
    expect(row.userId).toBeNull();
    // Текст не доехал до БД — только перечислимый surface (правило №7).
    expect(row.meta).toEqual({ surface: 'booking' });
    await prisma.analyticsEvent.delete({ where: { id: row.id } });
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
